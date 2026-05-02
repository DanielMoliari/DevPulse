import { UseGuards } from '@nestjs/common'
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql'
import { GqlAuthGuard } from '../../../../common/guards/gql-auth.guard'
import { CurrentUser, type JwtPayload } from '../../../../common/decorators/current-user.decorator'
import { AnalyticsService } from '../../application/services/analytics.service'
import { StreakService } from '../../application/services/streak.service'
import {
  DailyMetricsType,
  HeatmapDayType,
  LanguageHistoryType,
  MetricsRangeInput,
  RepoCuriosityType,
  RepoDetailType,
  RepositoryType,
  StreakType,
  SyncResultType,
  TechGraphType,
} from '../types/analytics.types'
import type { DailyMetrics } from '@prisma/client'

@Resolver()
@UseGuards(GqlAuthGuard)
export class AnalyticsResolver {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly streakService: StreakService,
  ) {}

  @Query(() => [RepositoryType], { description: 'List all tracked repositories' })
  async repositories(@CurrentUser() user: JwtPayload): Promise<RepositoryType[]> {
    const repos = await this.analyticsService.getRepositories(user.sub)
    return repos as unknown as RepositoryType[]
  }

  @Query(() => [DailyMetricsType], { description: 'Get daily metrics for a date range' })
  async metrics(
    @CurrentUser() user: JwtPayload,
    @Args('input') input: MetricsRangeInput,
  ): Promise<DailyMetricsType[]> {
    const raw = await this.analyticsService.getDashboardMetrics(user.sub, input.from, input.to)
    // Each tracked repo stores its own row per day — collapse to one row per date so the dashboard
    // sees user-wide totals instead of duplicate points per repo.
    const byDate = new Map<string, DailyMetrics>()
    for (const m of raw) {
      const dateObj = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
      const key = dateObj.toISOString().slice(0, 10)
      const existing = byDate.get(key)
      if (existing) {
        existing.commits += m.commits
        existing.additions += m.additions
        existing.deletions += m.deletions
        existing.prsOpened += m.prsOpened
        existing.prsMerged += m.prsMerged
        existing.reviewsDone += m.reviewsDone
      } else {
        byDate.set(key, { ...m, date: dateObj })
      }
    }
    return [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).map(this.mapMetrics)
  }

  @Query(() => StreakType, { nullable: true, description: 'Get current streak stats' })
  async streak(@CurrentUser() user: JwtPayload): Promise<StreakType | null> {
    const s = await this.streakService.getStreak(user.sub)
    const lastActive = s.lastActiveDate
      ? (s.lastActiveDate instanceof Date ? s.lastActiveDate : new Date(s.lastActiveDate as unknown as string))
      : null
    return {
      currentStreak: s.currentStreak,
      longestStreak: s.longestStreak,
      ...(lastActive ? { lastActiveDate: lastActive } : {}),
    }
  }

  @Query(() => TechGraphType, { description: 'User-wide tech graph: every tracked repo × every language it uses' })
  async techGraph(@CurrentUser() user: JwtPayload): Promise<TechGraphType> {
    return this.analyticsService.getTechGraph(user.sub)
  }

  @Query(() => LanguageHistoryType, { description: 'Cumulative language adoption per year (for streamgraph)' })
  async languageHistory(@CurrentUser() user: JwtPayload): Promise<LanguageHistoryType> {
    return this.analyticsService.getLanguageHistory(user.sub)
  }

  @Query(() => RepoDetailType, { description: 'Detailed insights for a single repository' })
  async repositoryDetail(
    @CurrentUser() user: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RepoDetailType> {
    const { repo, insight, metrics } = await this.analyticsService.getRepositoryDetail(user.sub, id)

    const totalBytes = Object.values(insight.languages).reduce((s, b) => s + b, 0)
    const languages = Object.entries(insight.languages)
      .map(([name, bytes]) => ({ name, bytes, percent: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0 }))
      .sort((a, b) => b.bytes - a.bytes)

    const totalCommits = metrics.reduce((s, m) => s + m.commits, 0)
    const totalAdditions = metrics.reduce((s, m) => s + m.additions, 0)
    const totalDeletions = metrics.reduce((s, m) => s + m.deletions, 0)
    const activeDays = new Set(
      metrics.filter((m) => m.commits > 0).map((m) => {
        const d = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
        return d.toISOString().slice(0, 10)
      }),
    ).size
    const ageMs = Date.now() - new Date(insight.createdAt).getTime()
    const ageDays = Math.floor(ageMs / 86_400_000)
    const ageYears = (ageDays / 365).toFixed(1)
    const topLang = languages[0]
    const fmt = (n: number) => n.toLocaleString('en-US')

    // ── computed insights ────────────────────────────────────────────────────
    // Day-of-week distribution from the 90-day window
    const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dowCount = new Array(7).fill(0) as number[]
    let bestDay = { date: '', commits: 0 }
    for (const m of metrics) {
      const d = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
      dowCount[d.getUTCDay()]! += m.commits
      if (m.commits > bestDay.commits) {
        bestDay = { date: d.toISOString().slice(0, 10), commits: m.commits }
      }
    }
    const peakDow = dowCount.indexOf(Math.max(...dowCount))
    // Consistency over the repo's whole lifetime (capped at the actual age in days, min 1 to avoid div-by-zero)
    const lifetimeDays = Math.max(ageDays, 1)
    const consistency = activeDays > 0 ? Math.round((activeDays / lifetimeDays) * 100) : 0
    const avgPerActiveDay = activeDays > 0 ? (totalCommits / activeDays).toFixed(1) : '—'

    const curiosities: RepoCuriosityType[] = [
      { label: 'Repository age', value: ageDays >= 365 ? `${ageYears} years (${fmt(ageDays)} days)` : `${fmt(ageDays)} days` },
      { label: 'Code size', value: insight.sizeKb >= 1024 ? `${(insight.sizeKb / 1024).toFixed(1)} MB` : `${fmt(insight.sizeKb)} KB` },
      { label: 'Languages', value: languages.length === 0 ? 'No code detected' : `${languages.length} · ${topLang!.name} dominates (${topLang!.percent.toFixed(1)}%)` },
      { label: 'Commits all-time', value: fmt(totalCommits) },
      { label: 'Most productive day', value: dowCount[peakDow]! > 0 ? `${DOW[peakDow]} (${fmt(dowCount[peakDow]!)} commits)` : '—' },
      { label: 'Best single day', value: bestDay.commits > 0 ? `${bestDay.date} · ${fmt(bestDay.commits)} commits` : '—' },
      { label: 'Avg commits per active day', value: String(avgPerActiveDay) },
      { label: 'Consistency', value: `${consistency}% — ${fmt(activeDays)} of ${fmt(lifetimeDays)} days active` },
      { label: 'Lines added all-time', value: fmt(totalAdditions) },
      { label: 'Lines removed all-time', value: fmt(totalDeletions) },
      { label: 'Stars · Forks · Watchers', value: `★ ${fmt(insight.stars)}  ⑂ ${fmt(insight.forks)}  👁 ${fmt(insight.watchers)}` },
      { label: 'Open issues', value: fmt(insight.openIssues) },
      { label: 'Default branch', value: insight.defaultBranch },
      ...(insight.license ? [{ label: 'License', value: insight.license }] : []),
      ...(insight.topics.length ? [{ label: 'Topics', value: insight.topics.join(', ') }] : []),
    ]

    const recentMetrics = metrics
      .map((m) => ({ ...m, date: m.date instanceof Date ? m.date : new Date(m.date as unknown as string) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(this.mapMetrics)

    return {
      repository: repo as unknown as RepositoryType,
      ...(insight.description ? { description: insight.description } : {}),
      ...(insight.homepage ? { homepage: insight.homepage } : {}),
      defaultBranch: insight.defaultBranch,
      stars: insight.stars,
      forks: insight.forks,
      watchers: insight.watchers,
      openIssues: insight.openIssues,
      sizeKb: insight.sizeKb,
      createdAt: new Date(insight.createdAt),
      ...(insight.pushedAt ? { pushedAt: new Date(insight.pushedAt) } : {}),
      topics: insight.topics,
      ...(insight.license ? { license: insight.license } : {}),
      totalBytes,
      languages,
      recentMetrics,
      curiosities,
    }
  }

  @Query(() => [HeatmapDayType], { description: 'Get contribution heatmap data' })
  async heatmap(
    @CurrentUser() user: JwtPayload,
    @Args('year', { type: () => Int, nullable: true }) year?: number,
  ): Promise<HeatmapDayType[]> {
    const targetYear = year ?? new Date().getFullYear()
    const from = new Date(`${targetYear}-01-01`)
    const to = new Date(`${targetYear}-12-31`)
    const metrics = await this.analyticsService.getDashboardMetrics(user.sub, from, to)

    // Aggregate commits across repos per day so the heatmap shows user-wide activity
    const byDay = new Map<string, number>()
    for (const m of metrics) {
      const dateObj = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
      const key = dateObj.toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + m.commits)
    }
    return [...byDay.entries()].map(([key, count]) => {
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4
      return { date: new Date(key), count, level }
    })
  }

  @Mutation(() => RepositoryType, { description: 'Start tracking a GitHub repository' })
  async trackRepository(
    @CurrentUser() user: JwtPayload,
    @Args('githubRepoId') githubRepoId: string,
  ): Promise<RepositoryType> {
    const repo = await this.analyticsService.trackRepository(user.sub, githubRepoId)
    return repo as unknown as RepositoryType
  }

  @Mutation(() => Boolean, { description: 'Re-import all GitHub repositories for the current user' })
  async importGitHubRepositories(@CurrentUser() user: JwtPayload): Promise<boolean> {
    await this.analyticsService.importFromGitHub(user.sub)
    return true
  }

  @Mutation(() => Boolean, { description: 'Stop tracking a repository' })
  async untrackRepository(
    @CurrentUser() user: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.analyticsService.untrackRepository(user.sub, id)
  }

  @Mutation(() => SyncResultType, { description: 'Trigger an on-demand repository sync' })
  async syncRepository(
    @CurrentUser() user: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SyncResultType> {
    return this.analyticsService.triggerSync(user.sub, id)
  }

  private mapMetrics(m: DailyMetrics): DailyMetricsType {
    const total = m.additions + m.deletions
    const base = {
      id: m.id,
      // Prisma 7 + pg driver returns @db.Date columns as ISO strings — coerce to Date so the GraphQL DateTime scalar can serialize
      date: m.date instanceof Date ? m.date : new Date(m.date as unknown as string),
      commits: m.commits,
      additions: m.additions,
      deletions: m.deletions,
      prsOpened: m.prsOpened,
      prsMerged: m.prsMerged,
      reviewsDone: m.reviewsDone,
      netLines: m.additions - m.deletions,
    }
    return total > 0 ? { ...base, churnRatio: m.deletions / total } : base
  }
}
