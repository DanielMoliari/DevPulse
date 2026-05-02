import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import type { DailyMetrics, Repository } from '@prisma/client'
import { QUEUE_SYNC_REPOSITORY } from '../../../../infrastructure/queue/queue.module'
import { RedisService } from '../../../../infrastructure/cache/redis.service'
import { IdentityService } from '../../../identity/application/services/identity.service'
import { PLAN_LIMITS } from '../../../identity/domain/plan-limits'
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
        isPrivate: ghRepo.private,
      })
      await this.enqueueSyncJob(userId, repo.id, repo.fullName)
      imported++
    }

    this.logger.log(`Initial import for ${userId}: ${imported} repos imported and queued for sync`)
    return { imported, tracked: imported }
  }

  async trackRepository(userId: string, githubRepoId: string): Promise<Repository> {
    // Plan-gate: skip the limit check if the repo is already tracked (re-tracking shouldn't bump the count)
    const existing = await this.metricsRepo.findRepositoryByGithubId(userId, githubRepoId)
    if (!existing || !existing.isTracked) {
      await this.assertCanTrackMore(userId)
    }

    const accessToken = await this.identityService.getDecryptedToken(userId)
    const repos = await this.github.getUserRepositories(accessToken)
    const target = repos.find((r) => String(r.id) === githubRepoId)
    if (!target) throw new NotFoundException(`Repository ${githubRepoId} not found on GitHub`)

    const repo = await this.metricsRepo.upsertRepository({
      userId,
      githubRepoId,
      fullName: target.fullName,
      language: target.language,
      isPrivate: target.private,
    })

    await this.enqueueSyncJob(userId, repo.id, repo.fullName)
    return repo
  }

  // Throws ForbiddenException with a user-facing upgrade message if adding one more
  // tracked repo would exceed the user's plan cap.
  private async assertCanTrackMore(userId: string): Promise<void> {
    const user = await this.identityService.findById(userId)
    if (!user) throw new NotFoundException('User not found')
    const limit = PLAN_LIMITS[user.plan].maxTrackedRepos
    const tracked = (await this.metricsRepo.findRepositoriesByUser(userId, true)).length
    if (tracked >= limit) {
      throw new ForbiddenException(
        `${user.plan} plan allows up to ${limit} tracked repos. Upgrade to track more.`,
      )
    }
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

  // Differentiating insights: hourly pattern, burnout flag, language graduation moments.
  // Hourly is GitHub-bound (1h cache), burnout is pure compute over getDailyMetrics,
  // graduations re-use languageHistory data so we don't pay for repo insights twice.
  async getInsights(userId: string): Promise<{
    hourlyActivity: { hours: number[]; peakHour: number; peakRatio: number } | null
    burnout: { atRisk: boolean; consecutiveDays: number; netLinesTrend: number; message: string } | null
    techGraduations: { from: string; to: string; year: number; confidence: number; message: string }[]
  }> {
    // hourlyActivity is intentionally NOT fetched here — it makes 20+ GitHub API calls
    // and would block the dashboard for 20-60s on cold cache. Use the separate
    // `hourlyActivity` query so the frontend can lazy-load it independently.
    const settle = <T>(p: Promise<T>, fallback: T): Promise<T> =>
      p.catch((err) => { this.logger.warn(`insight subcomputation failed: ${String(err)}`); return fallback })
    const [burnout, techGraduations] = await Promise.all([
      settle(this.computeBurnoutSignal(userId), null),
      settle(this.computeTechGraduations(userId), [] as { from: string; to: string; year: number; confidence: number; message: string }[]),
    ])
    return { hourlyActivity: null, burnout, techGraduations }
  }

  // Standalone hourly endpoint — slow first call (1-3 min for active users), 1h cache after.
  async getHourlyActivity(userId: string) {
    return this.computeHourlyActivity(userId)
  }

  // Sums commit-hour buckets across every tracked repo.
  // Cached for 1h — cold path is O(repos) GitHub calls and shifts slowly.
  // Capped at the 20 most-recently-pushed repos so the cold call doesn't time out
  // for users with hundreds of repos. Returns null if too expensive on first try.
  private async computeHourlyActivity(userId: string): Promise<{ hours: number[]; peakHour: number; peakRatio: number } | null> {
    const cacheKey = `analytics:hourly:${userId}`
    return this.redis.getOrSet(cacheKey, async () => {
      const allRepos = await this.metricsRepo.findRepositoriesByUser(userId, true)
      if (allRepos.length === 0) return null
      // Most recently synced first → captures what the user is actually working on
      const repos = allRepos
        .slice()
        .sort((a, b) => (b.lastSyncedAt?.getTime() ?? 0) - (a.lastSyncedAt?.getTime() ?? 0))
        .slice(0, 20)
      const accessToken = await this.identityService.getDecryptedToken(userId)

      // 1-year window keeps the cold call under ~3s for typical accounts
      const since = new Date()
      since.setUTCFullYear(since.getUTCFullYear() - 1)
      const totals = new Array(24).fill(0) as number[]

      const CHUNK = 8
      for (let i = 0; i < repos.length; i += CHUNK) {
        const chunk = repos.slice(i, i + CHUNK)
        const buckets = await Promise.all(chunk.map(async (r) => {
          const [owner, name] = r.fullName.split('/') as [string, string]
          try {
            return await this.github.getCommitHours(accessToken, owner, name, since)
          } catch (err) {
            this.logger.warn(`getCommitHours failed for ${r.fullName}: ${String(err)}`)
            return new Array(24).fill(0) as number[]
          }
        }))
        for (const b of buckets) for (let h = 0; h < 24; h++) totals[h]! += b[h] ?? 0
      }

      const sum = totals.reduce((s, n) => s + n, 0)
      if (sum === 0) return null
      const peakHour = totals.indexOf(Math.max(...totals))
      const mean = sum / 24
      const peakRatio = mean > 0 ? totals[peakHour]! / mean : 0
      return { hours: totals, peakHour, peakRatio }
    }, 3600)
  }

  // Pure computation from existing daily metrics — no extra GitHub calls.
  // Walks back from today counting consecutive active days, compares net lines window-on-window.
  private async computeBurnoutSignal(userId: string): Promise<{
    atRisk: boolean; consecutiveDays: number; netLinesTrend: number; message: string
  } | null> {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const from = new Date(today)
    from.setUTCDate(from.getUTCDate() - 29)
    const raw = await this.metricsRepo.getDailyMetrics(userId, from, today)
    if (raw.length === 0) return null

    // Roll multi-repo rows up to one daily total per date
    const byDay = new Map<string, { commits: number; netLines: number }>()
    for (const m of raw) {
      const dateObj = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
      const key = dateObj.toISOString().slice(0, 10)
      const existing = byDay.get(key) ?? { commits: 0, netLines: 0 }
      existing.commits += m.commits
      existing.netLines += m.additions - m.deletions
      byDay.set(key, existing)
    }

    // Walk back from today; the streak is broken by the first commitless day
    let consecutiveDays = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() - i)
      const key = d.toISOString().slice(0, 10)
      const day = byDay.get(key)
      if (day && day.commits > 0) consecutiveDays++
      else break
    }

    // Compare net lines: last 7 days vs the 7 before that
    const netSum = (offset: number, span: number) => {
      let total = 0
      for (let i = offset; i < offset + span; i++) {
        const d = new Date(today)
        d.setUTCDate(d.getUTCDate() - i)
        total += byDay.get(d.toISOString().slice(0, 10))?.netLines ?? 0
      }
      return total
    }
    const recent = netSum(0, 7)
    const prior = netSum(7, 7)
    const netLinesTrend = prior !== 0 ? Math.round(((recent - prior) / Math.abs(prior)) * 100) : 0

    const atRisk = consecutiveDays >= 14 && netLinesTrend < -25
    const message = atRisk
      ? `You've shipped ${consecutiveDays} days straight with ${netLinesTrend}% net lines — a rest day might recharge you.`
      : consecutiveDays >= 14
        ? `${consecutiveDays}-day streak going strong. Output is steady — keep your rhythm.`
        : consecutiveDays >= 7
          ? `${consecutiveDays} days in a row. Nice cadence.`
          : `Recent activity looks balanced.`

    return { atRisk, consecutiveDays, netLinesTrend, message }
  }

  // Re-uses languageHistory's cumulative byte series. We diff each year against the previous
  // and look for a clean swap: one language drops > 50% in share while another rises > 50%.
  // Filter out anything < 5KB total — that's just stray config files masquerading as a "language".
  private async computeTechGraduations(userId: string): Promise<{
    from: string; to: string; year: number; confidence: number; message: string
  }[]> {
    const { years, series } = await this.getLanguageHistory(userId)
    if (years.length < 2 || series.length === 0) return []

    // Year-over-year share per language (cumulative bytes → share of that year's total)
    const sharePerYear: Map<string, number>[] = years.map(() => new Map<string, number>())
    for (let yi = 0; yi < years.length; yi++) {
      const total = series.reduce((s, ser) => s + (ser.values[yi] ?? 0), 0)
      if (total === 0) continue
      for (const ser of series) {
        const share = (ser.values[yi] ?? 0) / total
        sharePerYear[yi]!.set(ser.language, share)
      }
    }

    // Total bytes per language for the noise filter (final cumulative value)
    const totalBytes = new Map<string, number>()
    for (const ser of series) totalBytes.set(ser.language, ser.values[ser.values.length - 1] ?? 0)

    const graduations: { from: string; to: string; year: number; confidence: number; message: string }[] = []

    for (let yi = 1; yi < years.length; yi++) {
      const prev = sharePerYear[yi - 1]!
      const curr = sharePerYear[yi]!
      let best: { from: string; to: string; risers: number; declined: number; combined: number } | null = null

      for (const [decl, prevShare] of prev) {
        if ((totalBytes.get(decl) ?? 0) < 5_120) continue
        const currShareDecl = curr.get(decl) ?? 0
        if (prevShare <= 0 || currShareDecl >= prevShare * 0.5) continue
        const declined = (prevShare - currShareDecl) / prevShare
        for (const [rise, currShareRise] of curr) {
          if (rise === decl) continue
          if ((totalBytes.get(rise) ?? 0) < 5_120) continue
          const prevShareRise = prev.get(rise) ?? 0
          if (currShareRise <= prevShareRise * 1.5) continue
          const risers = prevShareRise > 0
            ? (currShareRise - prevShareRise) / prevShareRise
            : currShareRise // brand new language → use absolute share as the rise score
          const combined = declined + Math.min(risers, 5)
          if (!best || combined > best.combined) {
            best = { from: decl, to: rise, risers, declined, combined }
          }
        }
      }

      if (best) {
        const confidence = Math.min(1, (best.declined + Math.min(best.risers, 1)) / 2)
        const finalShare = curr.get(best.to) ?? 0
        const message = `You moved from ${best.from} to ${best.to} in ${years[yi]} — ${best.to} now dominates ${Math.round(finalShare * 100)}% of your code.`
        graduations.push({ from: best.from, to: best.to, year: years[yi]!, confidence, message })
      }
    }

    return graduations
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
