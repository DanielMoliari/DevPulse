import { Inject, Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../../../../infrastructure/cache/redis.service'
import { IdentityService } from '../../../identity/application/services/identity.service'
import { METRICS_REPOSITORY, type IMetricsRepository } from '../../ports/metrics.repository.port'
import { AnalyticsService } from './analytics.service'
import { StreakService } from './streak.service'

export interface PublicProfileData {
  username: string
  displayName: string
  avatarUrl: string | null
  joinedAt: Date
  activeDays: number
  totalCommits: number
  currentStreak: number | null
  longestStreak: number | null
  topLanguages: { name: string; bytes: number; percent: number }[]
  recentActivity: { date: Date; count: number; level: number }[]
  trackedRepos: { fullName: string; language: string | null }[] | null
}

const PUBLIC_PROFILE_TTL = 300 // 5 minutes — viral pages should feel fresh but absorb traffic spikes

@Injectable()
export class PublicProfileService {
  private readonly logger = new Logger(PublicProfileService.name)

  constructor(
    private readonly identity: IdentityService,
    private readonly analytics: AnalyticsService,
    private readonly streaks: StreakService,
    @Inject(METRICS_REPOSITORY) private readonly metricsRepo: IMetricsRepository,
    private readonly redis: RedisService,
  ) {}

  // Returns null when user is missing OR has not opted into a public profile.
  // The 5-minute Redis cache shields the DB + tech-graph computation from a viral spike;
  // toggling prefs invalidates via `invalidate(username)`.
  async getPublicProfile(username: string): Promise<PublicProfileData | null> {
    const normalized = username.trim().toLowerCase()
    const cacheKey = `public-profile:${normalized}`
    return this.redis.getOrSet(
      cacheKey,
      async () => this.buildPublicProfile(normalized),
      PUBLIC_PROFILE_TTL,
    )
  }

  async invalidate(username: string | null | undefined): Promise<void> {
    if (!username) return
    await this.redis.del(`public-profile:${username.trim().toLowerCase()}`)
  }

  private async buildPublicProfile(username: string): Promise<PublicProfileData | null> {
    const user = await this.identity.findByUsername(username)
    if (!user || !user.username) return null

    // Fetch everything in parallel — none of these depend on each other.
    const [streak, techGraph, repos, allMetrics] = await Promise.all([
      user.publicShowStreak ? this.streaks.getStreak(user.id) : Promise.resolve(null),
      this.analytics.getTechGraph(user.id),
      this.metricsRepo.findRepositoriesByUser(user.id, true),
      this.metricsRepo.getDailyMetrics(user.id, new Date('2008-01-01'), new Date()),
    ])

    // Top 5 languages from the precomputed tech graph (cached for 1h on its own)
    const langNodes = techGraph.nodes.filter((n) => n.type === 'language')
    const totalLangBytes = langNodes.reduce((s, n) => s + n.value, 0)
    const topLanguages = langNodes
      .slice(0, 5)
      .map((n) => ({
        name: n.name,
        bytes: n.value,
        percent: totalLangBytes > 0 ? Math.round((n.value / totalLangBytes) * 10000) / 100 : 0,
      }))

    // All-time totals
    let totalCommits = 0
    const activeDaySet = new Set<string>()
    for (const m of allMetrics) {
      totalCommits += m.commits
      if (m.commits > 0) {
        const d = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
        activeDaySet.add(d.toISOString().slice(0, 10))
      }
    }

    // Last 365 days heatmap, aggregated across repos per day
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const oneYearAgoMs = today.getTime() - 364 * 86_400_000
    const byDay = new Map<string, number>()
    let recentActiveDays = 0
    for (const m of allMetrics) {
      const d = m.date instanceof Date ? m.date : new Date(m.date as unknown as string)
      if (d.getTime() < oneYearAgoMs) continue
      const key = d.toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + m.commits)
    }
    const recentActivity = [...byDay.entries()].map(([key, count]) => {
      if (count > 0) recentActiveDays++
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4
      return { date: new Date(key), count, level }
    })

    return {
      username: user.username,
      displayName: user.name ?? user.username,
      avatarUrl: user.avatarUrl,
      joinedAt: user.createdAt,
      activeDays: recentActiveDays,
      totalCommits,
      currentStreak: streak ? streak.currentStreak : null,
      longestStreak: streak ? streak.longestStreak : null,
      topLanguages,
      recentActivity,
      // Public profile must NEVER expose private repos by name — even if the user
      // opted into "show tracked repos", filter to only the public ones.
      trackedRepos: user.publicShowRepos
        ? repos.filter((r) => !r.isPrivate).map((r) => ({ fullName: r.fullName, language: r.language }))
        : null,
    }
  }
}
