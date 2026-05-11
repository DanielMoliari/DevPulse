import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import type { DailyMetrics, Repository } from '@prisma/client'
import { QUEUE_SYNC_REPOSITORY } from '../../../../infrastructure/queue/queue.module'
import { RedisService } from '../../../../infrastructure/cache/redis.service'
import { IdentityService } from '../../../identity/application/services/identity.service'
import { PLAN_LIMITS } from '../../../identity/domain/plan-limits'
import { GITHUB_PORT, type FileChurnDto, type IGitHubPort, type RepoInsightDto } from '../../ports/github.port'
import { METRICS_REPOSITORY, type IMetricsRepository, type RepoMetricsTotals } from '../../ports/metrics.repository.port'

export type EnrichedRepository = Repository & Pick<RepoMetricsTotals, 'commitCount' | 'linesAdded'>

export interface HealthBreakdown {
  churn: number
  consistency: number
  mergeRate: number
  cadence: number
}

export interface CodeHealthResult {
  score: number
  grade: string
  breakdown: HealthBreakdown
}

export function computeHealthScore(metrics: DailyMetrics[], insight: RepoInsightDto): CodeHealthResult {
  // ── Churn score (30%) ────────────────────────────────────────────────────
  const metricsWithChurn = metrics.filter((m) => m.additions + m.deletions > 0)
  let churnScore = 60
  if (metricsWithChurn.length > 0) {
    const avgChurnRatio =
      metricsWithChurn.reduce((s, m) => s + m.deletions / (m.additions + m.deletions), 0) /
      metricsWithChurn.length
    churnScore =
      avgChurnRatio < 0.2 ? 100
      : avgChurnRatio < 0.35 ? 80
      : avgChurnRatio < 0.5 ? 60
      : avgChurnRatio < 0.65 ? 40
      : 20
  }

  // ── Consistency score (25%) ──────────────────────────────────────────────
  const ageMs = Date.now() - new Date(insight.createdAt).getTime()
  const lifetimeDays = Math.max(Math.floor(ageMs / 86_400_000), 1)
  const activeDays = new Set(
    metrics
      .filter((m) => m.commits > 0)
      .map((m) => {
        const d = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
        return d.toISOString().slice(0, 10)
      }),
  ).size
  const consistencyRatio = activeDays / lifetimeDays
  const consistencyScore =
    consistencyRatio > 0.3 ? 100
    : consistencyRatio > 0.15 ? 80
    : consistencyRatio > 0.07 ? 60
    : consistencyRatio > 0.03 ? 40
    : 20

  // ── Merge rate score (25%) ───────────────────────────────────────────────
  const totalPrsOpened = metrics.reduce((s, m) => s + m.prsOpened, 0)
  const totalPrsMerged = metrics.reduce((s, m) => s + m.prsMerged, 0)
  let mergeRateScore = 70
  if (totalPrsOpened > 0) {
    const mergeRatio = totalPrsMerged / totalPrsOpened
    mergeRateScore =
      mergeRatio > 0.8 ? 100
      : mergeRatio > 0.6 ? 80
      : mergeRatio > 0.4 ? 60
      : mergeRatio > 0.2 ? 40
      : 20
  }

  // ── Cadence score (20%) ──────────────────────────────────────────────────
  const weeklyCommits = new Map<string, number>()
  for (const m of metrics) {
    const d = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
    const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
    const weekNum = Math.ceil(((d.getTime() - jan4.getTime()) / 86_400_000 + jan4.getUTCDay() + 1) / 7)
    const weekKey = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
    weeklyCommits.set(weekKey, (weeklyCommits.get(weekKey) ?? 0) + m.commits)
  }
  const weeks = [...weeklyCommits.values()]
  let cadenceScore = 60
  if (weeks.length >= 2) {
    const mean = weeks.reduce((s, n) => s + n, 0) / weeks.length
    if (mean > 0) {
      const variance = weeks.reduce((s, n) => s + (n - mean) ** 2, 0) / weeks.length
      const cv = Math.sqrt(variance) / mean
      cadenceScore =
        cv < 0.5 ? 100
        : cv < 1.0 ? 80
        : cv < 1.5 ? 60
        : cv < 2.0 ? 40
        : 20
    }
  }

  // ── Weighted average ─────────────────────────────────────────────────────
  const score = Math.round(
    churnScore * 0.3 +
    consistencyScore * 0.25 +
    mergeRateScore * 0.25 +
    cadenceScore * 0.2,
  )

  const grade =
    score >= 90 ? 'A'
    : score >= 75 ? 'B'
    : score >= 60 ? 'C'
    : score >= 45 ? 'D'
    : 'F'

  return {
    score,
    grade,
    breakdown: { churn: churnScore, consistency: consistencyScore, mergeRate: mergeRateScore, cadence: cadenceScore },
  }
}

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

  async getRepositories(userId: string): Promise<EnrichedRepository[]> {
    let repos = await this.metricsRepo.findRepositoriesByUser(userId)
    if (repos.length === 0) {
      // First call after OAuth — populate from GitHub so the user sees their data
      await this.importFromGitHub(userId)
      repos = await this.metricsRepo.findRepositoriesByUser(userId)
    }
    const totalsMap = new Map(
      (await this.metricsRepo.getRepoMetricsTotals(userId)).map((t) => [t.repoId, t]),
    )
    return repos.map((r) => ({
      ...r,
      commitCount: totalsMap.get(r.id)?.commitCount ?? 0,
      linesAdded: totalsMap.get(r.id)?.linesAdded ?? 0,
    }))
  }

  // Pull every repo the user owns, track all of them (all plans now have unlimited tracked repos),
  // and queue sync jobs for each. Repos are sorted most-recently-pushed first so syncs prioritise active work.
  async importFromGitHub(userId: string): Promise<{ imported: number; tracked: number }> {
    const accessToken = await this.identityService.getDecryptedToken(userId)
    const ghRepos = await this.github.getUserRepositories(accessToken)

    // Sort by most recently pushed so active repos sync first
    const sorted = [...ghRepos].sort((a, b) => {
      const at = a.pushedAt ? new Date(a.pushedAt).getTime() : 0
      const bt = b.pushedAt ? new Date(b.pushedAt).getTime() : 0
      return bt - at
    })

    let imported = 0
    let tracked = 0
    for (const ghRepo of sorted) {
      const repo = await this.metricsRepo.upsertRepository({
        userId,
        githubRepoId: String(ghRepo.id),
        fullName: ghRepo.fullName,
        language: ghRepo.language,
        pushedAt: ghRepo.pushedAt,
        isTracked: true,
        isPrivate: ghRepo.private,
      })
      await this.enqueueSyncJob(userId, repo.id, repo.fullName)
      tracked++
      imported++
    }

    this.logger.log(`Initial import for ${userId}: ${imported} repos imported and tracked`)
    return { imported, tracked }
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
      pushedAt: target.pushedAt,
      isPrivate: target.private,
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
    if (!repo.isTracked) throw new ForbiddenException('Repository is not tracked — track it first to sync')
    await this.enqueueSyncJob(userId, repo.id, repo.fullName)
    return { repositoryId: repo.id, queued: true }
  }

  // Detail page fetches GitHub on demand and caches for 10 minutes — most metadata changes slowly
  async getRepositoryDetail(userId: string, repoId: string) {
    const repo = await this.metricsRepo.findRepositoryById(repoId)
    if (!repo) throw new NotFoundException('Repository not found')
    if (repo.userId !== userId) throw new ForbiddenException('Not your repository')

    const [owner, name] = repo.fullName.split('/') as [string, string]

    const accessToken = await this.identityService.getDecryptedToken(userId)
    const since90 = new Date(Date.now() - 90 * 86_400_000)

    const insight = await this.redis.getOrSet(
      `analytics:repo-insight:${repo.id}`,
      () => this.github.getRepositoryInsights(accessToken, owner, name),
      600,
    )

    const [prsDetail, metrics] = await Promise.all([
      this.redis.getOrSet(
        `analytics:repo-prs:${repo.id}`,
        async () => {
          const prs = await this.github.getPullRequests(accessToken, owner, name, since90)
          return prs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            category: this.categorizePR(pr),
            createdAt: pr.createdAt,
            ...(pr.mergedAt ? { mergedAt: pr.mergedAt } : {}),
            filesChanged: pr.filesChanged,
            additions: pr.additions,
            deletions: pr.deletions,
          }))
        },
        600,
      ),
      this.metricsRepo.getDailyMetrics(userId, new Date(insight.createdAt), new Date(), repo.id),
    ])

    const [ecosystemConnections, fileOwnership, fileHotspots] = await Promise.all([
      this.redis.getOrSet(
        `analytics:ecosystem:${repo.id}`,
        () => this.getEcosystemConnections(userId, repo),
        3600,
      ),
      this.redis.getOrSet(
        `analytics:file-ownership:${repo.id}`,
        async () => {
          const userLogin = await this.github.getAuthenticatedUserLogin(accessToken)
          return this.github.getFileOwnership(accessToken, owner, name, userLogin)
        },
        7200,
      ),
      this.redis.getOrSet(
        `analytics:file-churn:${repo.id}`,
        () => this.github.getFileChurn(accessToken, owner, name, since90),
        3600,
      ),
    ])

    return { repo, insight, metrics, prsDetail, ecosystemConnections, fileOwnership, fileHotspots }
  }

  private categorizePR(pr: { filesChanged: number; additions: number; deletions: number }): 'high-impact' | 'refactor' | 'patch' {
    const total = pr.additions + pr.deletions
    if (total < 50 || pr.filesChanged <= 2) return 'patch'
    if (pr.deletions > pr.additions * 0.7) return 'refactor'
    return 'high-impact'
  }

  private async getEcosystemConnections(
    userId: string,
    targetRepo: Repository,
  ): Promise<{ repoFullName: string; ecosystem: string; sharedDeps: string[]; sharedCount: number; overlapScore: number }[]> {
    const [targetOwner, targetName] = targetRepo.fullName.split('/') as [string, string]
    const accessToken = await this.identityService.getDecryptedToken(userId)
    const targetManifest = await this.redis.getOrSet(
      `analytics:deps:${targetRepo.id}`,
      () => this.github.getDependencyManifest(accessToken, targetOwner, targetName),
      3600,
    )
    if (!targetManifest || targetManifest.deps.length === 0) return []

    const targetDeps = new Set([...targetManifest.deps, ...targetManifest.devDeps])

    const allRepos = await this.metricsRepo.findRepositoriesByUser(userId, true)
    const otherRepos = allRepos.filter((r) => r.id !== targetRepo.id)

    const connections: { repoFullName: string; ecosystem: string; sharedDeps: string[]; sharedCount: number; overlapScore: number }[] = []

    const CHUNK = 8
    for (let i = 0; i < otherRepos.length; i += CHUNK) {
      const chunk = otherRepos.slice(i, i + CHUNK)
      await Promise.all(chunk.map(async (r) => {
        try {
          const [o, n] = r.fullName.split('/') as [string, string]
          const manifest = await this.redis.getOrSet(
            `analytics:deps:${r.id}`,
            () => this.github.getDependencyManifest(accessToken, o, n),
            3600,
          )
          if (!manifest || manifest.ecosystem !== targetManifest.ecosystem) return
          const repoDeps = new Set([...manifest.deps, ...manifest.devDeps])
          const shared = [...targetDeps].filter((d) => repoDeps.has(d))
          if (shared.length < 2) return
          const overlapScore = shared.length / Math.min(targetDeps.size, repoDeps.size)
          connections.push({
            repoFullName: r.fullName,
            ecosystem: manifest.ecosystem,
            sharedDeps: shared.slice(0, 5),
            sharedCount: shared.length,
            overlapScore,
          })
        } catch { /* skip */ }
      }))
    }

    return connections.sort((a, b) => b.overlapScore - a.overlapScore).slice(0, 5)
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

  // Sums commit-hour buckets across the user's most active repos.
  // Cached for 1h — cold path is O(repos) GitHub calls and shifts slowly.
  // Picks repos by actual commit activity (from daily_metrics, not sync recency)
  // so users with hundreds of inactive repos still get meaningful hourly data.
  private async computeHourlyActivity(userId: string): Promise<{ hours: number[]; peakHour: number; peakRatio: number } | null> {
    const cacheKey = `analytics:hourly:${userId}`
    return this.redis.getOrSet(cacheKey, async () => {
      const allRepos = await this.metricsRepo.findRepositoriesByUser(userId, true)
      if (allRepos.length === 0) return null

      // Rank repos by their actual commit count over all time (from our DB, free)
      const sinceAllTime = new Date('2008-01-01T00:00:00Z')
      const allMetrics = await this.metricsRepo.getDailyMetrics(userId, sinceAllTime, new Date())
      const commitCountByRepo = new Map<string, number>()
      for (const m of allMetrics) {
        if (m.repoId) commitCountByRepo.set(m.repoId, (commitCountByRepo.get(m.repoId) ?? 0) + m.commits)
      }
      const repos = allRepos
        .filter((r) => (commitCountByRepo.get(r.id) ?? 0) > 0)
        .sort((a, b) => (commitCountByRepo.get(b.id) ?? 0) - (commitCountByRepo.get(a.id) ?? 0))
        .slice(0, 20)

      if (repos.length === 0) return null

      const accessToken = await this.identityService.getDecryptedToken(userId)
      // All-time window — only 20 repos matters more than time bound, since GitHub paginates anyway
      const since = sinceAllTime
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

  async getPersonalRecords(userId: string): Promise<{
    commits: { today: number; allTimeBest: number; isRecord: boolean }
    additions: { today: number; allTimeBest: number; isRecord: boolean }
    netLines: { today: number; allTimeBest: number; isRecord: boolean }
    hasNewRecord: boolean
  }> {
    const allTime = await this.metricsRepo.getDailyMetrics(userId, new Date('2008-01-01'), new Date())
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayKey = today.toISOString().slice(0, 10)

    const byDay = new Map<string, { commits: number; additions: number; netLines: number }>()
    for (const m of allTime) {
      const d = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
      const key = d.toISOString().slice(0, 10)
      const existing = byDay.get(key) ?? { commits: 0, additions: 0, netLines: 0 }
      existing.commits += m.commits
      existing.additions += m.additions
      existing.netLines += m.additions - m.deletions
      byDay.set(key, existing)
    }

    const todayData = byDay.get(todayKey) ?? { commits: 0, additions: 0, netLines: 0 }
    let bestCommits = 0, bestAdditions = 0, bestNetLines = 0
    for (const [key, day] of byDay) {
      if (key === todayKey) continue
      if (day.commits > bestCommits) bestCommits = day.commits
      if (day.additions > bestAdditions) bestAdditions = day.additions
      if (day.netLines > bestNetLines) bestNetLines = day.netLines
    }

    const commitsRecord = todayData.commits > 0 && todayData.commits > bestCommits
    const additionsRecord = todayData.additions > 0 && todayData.additions > bestAdditions
    const netLinesRecord = todayData.netLines > 0 && todayData.netLines > bestNetLines

    return {
      commits: { today: todayData.commits, allTimeBest: Math.max(bestCommits, todayData.commits), isRecord: commitsRecord },
      additions: { today: todayData.additions, allTimeBest: Math.max(bestAdditions, todayData.additions), isRecord: additionsRecord },
      netLines: { today: todayData.netLines, allTimeBest: Math.max(bestNetLines, todayData.netLines), isRecord: netLinesRecord },
      hasNewRecord: commitsRecord || additionsRecord || netLinesRecord,
    }
  }

  private async enqueueSyncJob(userId: string, repositoryId: string, fullName: string): Promise<void> {
    const jobData: SyncJobData = { userId, repositoryId, fullName }
    await this.syncQueue.add('sync', jobData, {
      jobId: `sync-${repositoryId}`,
      removeOnComplete: true,
    })
    this.logger.log(`Sync job queued for ${fullName}`)
  }

  async autoSyncStaleRepositories(): Promise<void> {
    // Pull broadly (1h staleness floor) then filter per-user based on their prefs.
    // Users who disabled auto-sync are skipped; the user's chosen interval (1/6/24h) is enforced.
    const ONE_HOUR_MS = 60 * 60 * 1_000
    const stale = await this.metricsRepo.findStaleTrackedRepositories(ONE_HOUR_MS)
    if (stale.length === 0) {
      this.logger.log('Auto-sync: no stale repositories')
      return
    }

    // Group by userId so we hit the user table once per user
    const byUser = new Map<string, typeof stale>()
    for (const repo of stale) {
      const arr = byUser.get(repo.userId) ?? []
      arr.push(repo)
      byUser.set(repo.userId, arr)
    }

    let queued = 0
    let skippedUsers = 0
    const now = Date.now()
    for (const [userId, repos] of byUser) {
      const user = await this.identityService.findById(userId)
      if (!user || !user.autoSyncEnabled) {
        skippedUsers++
        continue
      }
      const intervalMs = user.autoSyncIntervalHours * 60 * 60 * 1_000
      for (const repo of repos) {
        const lastSyncedMs = repo.lastSyncedAt ? new Date(repo.lastSyncedAt).getTime() : 0
        if (now - lastSyncedMs < intervalMs) continue
        await this.enqueueSyncJob(repo.userId, repo.id, repo.fullName)
        queued++
      }
    }
    this.logger.log(`Auto-sync: enqueued ${queued} repos across ${byUser.size - skippedUsers} active users (skipped ${skippedUsers} users with autoSync disabled)`)
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync(): Promise<void> {
    await this.autoSyncStaleRepositories()
  }
}
