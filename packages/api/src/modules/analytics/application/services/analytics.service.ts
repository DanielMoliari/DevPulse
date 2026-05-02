import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import type { DailyMetrics, Repository } from '@prisma/client'
import { QUEUE_SYNC_REPOSITORY } from '../../../../infrastructure/queue/queue.module'
import { RedisService } from '../../../../infrastructure/cache/redis.service'
import { IdentityService } from '../../../identity/application/services/identity.service'
import { GITHUB_PORT, type IGitHubPort } from '../../ports/github.port'
import { METRICS_REPOSITORY, type IMetricsRepository } from '../../ports/metrics.repository.port'

export interface SyncJobData {
  userId: string
  repositoryId: string
  fullName: string
}

const DASHBOARD_CACHE_TTL = 300 // 5 minutes

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(
    @Inject(GITHUB_PORT) private readonly github: IGitHubPort,
    @Inject(METRICS_REPOSITORY) private readonly metricsRepo: IMetricsRepository,
    private readonly identityService: IdentityService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUE_SYNC_REPOSITORY) private readonly syncQueue: Queue,
  ) {}

  async getRepositories(userId: string): Promise<Repository[]> {
    const existing = await this.metricsRepo.findRepositoriesByUser(userId)
    if (existing.length > 0) return existing
    // First call after OAuth — populate from GitHub so the user sees their data
    await this.importFromGitHub(userId)
    return this.metricsRepo.findRepositoriesByUser(userId)
  }

  // Pull every repo the user owns, track them all, and queue sync jobs.
  // GitHub is a record of years of work — language stats and "all-time" metrics
  // are only meaningful when every repo contributes. BullMQ runs jobs in parallel
  // and the user just sees a "syncing" indicator while it backfills.
  async importFromGitHub(userId: string): Promise<{ imported: number; tracked: number }> {
    const accessToken = await this.identityService.getDecryptedToken(userId)
    const ghRepos = await this.github.getUserRepositories(accessToken)

    let imported = 0
    for (const ghRepo of ghRepos) {
      const repo = await this.metricsRepo.upsertRepository({
        userId,
        githubRepoId: String(ghRepo.id),
        fullName: ghRepo.fullName,
        language: ghRepo.language,
        isTracked: true,
      })
      await this.enqueueSyncJob(userId, repo.id, repo.fullName)
      imported++
    }

    this.logger.log(`Initial import for ${userId}: ${imported} repos imported and queued for sync`)
    return { imported, tracked: imported }
  }

  async trackRepository(userId: string, githubRepoId: string): Promise<Repository> {
    const accessToken = await this.identityService.getDecryptedToken(userId)
    const repos = await this.github.getUserRepositories(accessToken)
    const target = repos.find((r) => String(r.id) === githubRepoId)
    if (!target) throw new NotFoundException(`Repository ${githubRepoId} not found on GitHub`)

    const repo = await this.metricsRepo.upsertRepository({
      userId,
      githubRepoId,
      fullName: target.fullName,
      language: target.language,
    })

    await this.enqueueSyncJob(userId, repo.id, repo.fullName)
    return repo
  }

  async untrackRepository(userId: string, repoId: string): Promise<boolean> {
    const repo = await this.metricsRepo.findRepositoryById(repoId)
    if (!repo) throw new NotFoundException('Repository not found')
    if (repo.userId !== userId) throw new ForbiddenException('Not your repository')
    await this.metricsRepo.setRepositoryTracked(repoId, false)
    return true
  }

  async triggerSync(userId: string, repoId: string): Promise<{ repositoryId: string; queued: boolean }> {
    const repo = await this.metricsRepo.findRepositoryById(repoId)
    if (!repo) throw new NotFoundException('Repository not found')
    if (repo.userId !== userId) throw new ForbiddenException('Not your repository')
    await this.enqueueSyncJob(userId, repo.id, repo.fullName)
    return { repositoryId: repo.id, queued: true }
  }

  // Detail page fetches GitHub on demand and caches for 10 minutes — most metadata changes slowly
  async getRepositoryDetail(userId: string, repoId: string) {
    const repo = await this.metricsRepo.findRepositoryById(repoId)
    if (!repo) throw new NotFoundException('Repository not found')
    if (repo.userId !== userId) throw new ForbiddenException('Not your repository')

    const cacheKey = `analytics:repo-insight:${repo.id}`
    const insight = await this.redis.getOrSet(
      cacheKey,
      async () => {
        const accessToken = await this.identityService.getDecryptedToken(userId)
        const [owner, name] = repo.fullName.split('/') as [string, string]
        return this.github.getRepositoryInsights(accessToken, owner, name)
      },
      600,
    )

    // All-time slice — backfill window is bounded by the repo's createdAt on GitHub anyway,
    // so "since createdAt" gives us every metric we ever stored for this repo.
    const metrics = await this.metricsRepo.getDailyMetrics(
      userId,
      new Date(insight.createdAt),
      new Date(),
      repo.id,
    )

    return { repo, insight, metrics }
  }

  // Language adoption history: which languages the user picked up and when, derived from
  // each repo's createdAt + its dominant language. Returns one row per (year, language)
  // suitable for a stacked area / streamgraph.
  async getLanguageHistory(userId: string): Promise<{
    years: number[]
    series: { language: string; values: number[] }[]
  }> {
    const cacheKey = `analytics:lang-history:${userId}`
    return this.redis.getOrSet(cacheKey, async () => {
      const repos = await this.metricsRepo.findRepositoriesByUser(userId, true)
      const accessToken = await this.identityService.getDecryptedToken(userId)

      const yearLang = new Map<number, Map<string, number>>()
      const minYear = new Date().getUTCFullYear()
      let earliest = minYear

      for (let i = 0; i < repos.length; i += 8) {
        const chunk = repos.slice(i, i + 8)
        await Promise.all(chunk.map(async (r) => {
          const insight = await this.redis.getOrSet(
            `analytics:repo-insight:${r.id}`,
            async () => {
              const [owner, name] = r.fullName.split('/') as [string, string]
              return this.github.getRepositoryInsights(accessToken, owner, name)
            }, 600,
          )
          const year = new Date(insight.createdAt).getUTCFullYear()
          if (year < earliest) earliest = year
          const map = yearLang.get(year) ?? new Map<string, number>()
          for (const [lang, bytes] of Object.entries(insight.languages)) {
            map.set(lang, (map.get(lang) ?? 0) + bytes)
          }
          yearLang.set(year, map)
        }))
      }

      const thisYear = new Date().getUTCFullYear()
      const years: number[] = []
      for (let y = earliest; y <= thisYear; y++) years.push(y)

      // Cumulative across years (a language picked up in 2020 still counts in 2026)
      const allLangs = new Set<string>()
      for (const m of yearLang.values()) for (const k of m.keys()) allLangs.add(k)

      const series: { language: string; values: number[] }[] = []
      for (const lang of allLangs) {
        const values: number[] = []
        let running = 0
        for (const y of years) {
          running += yearLang.get(y)?.get(lang) ?? 0
          values.push(running)
        }
        series.push({ language: lang, values })
      }
      // Sort by final size descending — biggest languages on top
      series.sort((a, b) => (b.values[b.values.length - 1] ?? 0) - (a.values[a.values.length - 1] ?? 0))

      return { years, series }
    }, 3600)
  }

  // Build a global tech graph: every tracked repo × every language it uses, with byte weights.
  // Cached for 1h because resolving 60 repos × language insights is O(60 GitHub calls) cold,
  // and the underlying data only changes when source files are added/removed.
  async getTechGraph(userId: string): Promise<{
    nodes: { id: string; type: 'repo' | 'language'; name: string; value: number }[]
    links: { source: string; target: string; value: number }[]
  }> {
    const cacheKey = `analytics:tech-graph:${userId}`
    return this.redis.getOrSet(
      cacheKey,
      async () => {
        const repos = await this.metricsRepo.findRepositoriesByUser(userId, true)
        const accessToken = await this.identityService.getDecryptedToken(userId)

        const langTotals = new Map<string, number>()
        const repoNodes: { id: string; type: 'repo'; name: string; value: number }[] = []
        const links: { source: string; target: string; value: number }[] = []

        // Concurrent insight fetches (8 at a time keeps us well under rate limit)
        const CHUNK = 8
        for (let i = 0; i < repos.length; i += CHUNK) {
          const chunk = repos.slice(i, i + CHUNK)
          const results = await Promise.all(chunk.map(async (r) => {
            const cached = `analytics:repo-insight:${r.id}`
            const insight = await this.redis.getOrSet(cached, async () => {
              const [owner, name] = r.fullName.split('/') as [string, string]
              return this.github.getRepositoryInsights(accessToken, owner, name)
            }, 600)
            return { repo: r, insight }
          }))

          for (const { repo, insight } of results) {
            const totalBytes = Object.values(insight.languages).reduce((s, b) => s + b, 0)
            if (totalBytes === 0) continue
            const repoId = `repo:${repo.id}`
            repoNodes.push({ id: repoId, type: 'repo', name: repo.fullName, value: totalBytes })
            for (const [lang, bytes] of Object.entries(insight.languages)) {
              langTotals.set(lang, (langTotals.get(lang) ?? 0) + bytes)
              links.push({ source: repoId, target: `lang:${lang}`, value: bytes })
            }
          }
        }

        const langNodes = [...langTotals.entries()]
          .map(([name, value]) => ({ id: `lang:${name}`, type: 'language' as const, name, value }))
          .sort((a, b) => b.value - a.value)

        return { nodes: [...langNodes, ...repoNodes], links }
      },
      3600,
    )
  }

  async getDashboardMetrics(userId: string, from: Date, to: Date): Promise<DailyMetrics[]> {
    const cacheKey = `analytics:dashboard:${userId}:${from.toISOString().slice(0, 10)}:${to.toISOString().slice(0, 10)}`
    return this.redis.getOrSet(
      cacheKey,
      () => this.metricsRepo.getDailyMetrics(userId, from, to),
      DASHBOARD_CACHE_TTL,
    )
  }

  async getRepositoryMetrics(userId: string, repoId: string, from: Date, to: Date): Promise<DailyMetrics[]> {
    return this.metricsRepo.getDailyMetrics(userId, from, to, repoId)
  }

  async invalidateDashboardCache(userId: string): Promise<void> {
    await this.redis.delPattern(`analytics:dashboard:${userId}:*`)
  }

  private async enqueueSyncJob(userId: string, repositoryId: string, fullName: string): Promise<void> {
    const jobData: SyncJobData = { userId, repositoryId, fullName }
    await this.syncQueue.add('sync', jobData, {
      jobId: `sync-${repositoryId}`,
      removeOnComplete: true,
    })
    this.logger.log(`Sync job queued for ${fullName}`)
  }
}
