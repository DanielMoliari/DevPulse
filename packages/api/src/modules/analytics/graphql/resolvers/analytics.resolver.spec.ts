import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules that transitively require the ungenerated Prisma client
vi.mock('@prisma/client', () => ({
  SyncState: { IDLE: 'IDLE', SYNCING: 'SYNCING', ERROR: 'ERROR' },
}))

import { AnalyticsResolver } from './analytics.resolver'
import type { AnalyticsService } from '../../application/services/analytics.service'
import type { StreakService } from '../../application/services/streak.service'
import type { IdentityService } from '../../../identity/application/services/identity.service'
import type { JwtPayload } from '../../../../common/decorators/current-user.decorator'

interface FakeDailyMetrics {
  id: string; date: Date; commits: number; additions: number; deletions: number
  prsOpened: number; prsMerged: number; reviewsDone: number; userId: string; repoId: string | null
}
interface FakeStreak {
  id: string; userId: string; currentStreak: number; longestStreak: number; lastActiveDate: Date | null
}

const mockUser: JwtPayload = { sub: 'user-123', githubId: 'gh-1', plan: 'free', iat: 0, exp: 9999999999 }

const makeAnalyticsService = () => ({
  getRepositories: vi.fn(),
  getDashboardMetrics: vi.fn(),
  trackRepository: vi.fn(),
  untrackRepository: vi.fn(),
  triggerSync: vi.fn(),
}) as unknown as AnalyticsService

const makeStreakService = () => ({
  getStreak: vi.fn(),
  recalculate: vi.fn(),
}) as unknown as StreakService

const makeIdentityService = () => ({
  findById: vi.fn().mockResolvedValue({ plan: 'PRO' }),
}) as unknown as IdentityService

describe('AnalyticsResolver', () => {
  let resolver: AnalyticsResolver
  let analyticsService: AnalyticsService & Record<string, ReturnType<typeof vi.fn>>
  let streakService: StreakService & Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    analyticsService = makeAnalyticsService() as AnalyticsService & Record<string, ReturnType<typeof vi.fn>>
    streakService = makeStreakService() as StreakService & Record<string, ReturnType<typeof vi.fn>>
    const identityService = makeIdentityService()
    // Instantiate directly — avoids NestJS DI which needs emitDecoratorMetadata
    resolver = new AnalyticsResolver(analyticsService, streakService, identityService)
  })

  it('metrics() calls getDashboardMetrics with correct args and maps the result', async () => {
    const raw: FakeDailyMetrics[] = [
      { id: 'dm-1', date: new Date('2026-04-01'), commits: 3, additions: 10, deletions: 2,
        prsOpened: 1, prsMerged: 0, reviewsDone: 0, userId: 'user-123', repoId: null },
    ]
    vi.mocked(analyticsService.getDashboardMetrics).mockResolvedValue(raw as never)

    const input = { from: new Date('2026-04-01'), to: new Date('2026-04-30') }
    const result = await resolver.metrics(mockUser, input)

    expect(analyticsService.getDashboardMetrics).toHaveBeenCalledWith('user-123', input.from, input.to)
    expect(result[0]).toMatchObject({ id: 'dm-1', commits: 3, netLines: 8 })
  })

  it('streak() calls getStreak and maps fields', async () => {
    const fakeStreak: FakeStreak = {
      id: 's-1', userId: 'user-123', currentStreak: 5, longestStreak: 10,
      lastActiveDate: new Date('2026-04-29'),
    }
    vi.mocked(streakService.getStreak).mockResolvedValue(fakeStreak as never)

    const result = await resolver.streak(mockUser)

    expect(streakService.getStreak).toHaveBeenCalledWith('user-123')
    expect(result).toMatchObject({ currentStreak: 5, longestStreak: 10 })
  })

  it('heatmap() returns correctly levelled days', async () => {
    const raw: FakeDailyMetrics[] = [
      { id: 'dm-1', date: new Date('2026-01-01'), commits: 0, additions: 0, deletions: 0,
        prsOpened: 0, prsMerged: 0, reviewsDone: 0, userId: 'user-123', repoId: null },
      { id: 'dm-2', date: new Date('2026-01-02'), commits: 2, additions: 5, deletions: 1,
        prsOpened: 0, prsMerged: 0, reviewsDone: 0, userId: 'user-123', repoId: null },
      { id: 'dm-3', date: new Date('2026-01-03'), commits: 11, additions: 50, deletions: 10,
        prsOpened: 0, prsMerged: 0, reviewsDone: 0, userId: 'user-123', repoId: null },
    ]
    vi.mocked(analyticsService.getDashboardMetrics).mockResolvedValue(raw as never)

    const result = await resolver.heatmap(mockUser, 2026)

    expect(analyticsService.getDashboardMetrics).toHaveBeenCalled()
    expect(result[0]).toMatchObject({ level: 0, count: 0 })
    expect(result[1]).toMatchObject({ level: 1, count: 2 })
    expect(result[2]).toMatchObject({ level: 4, count: 11 })
  })
})
