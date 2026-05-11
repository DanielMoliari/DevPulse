import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DailyMetrics, Repository } from '@prisma/client'
import { AnalyticsService } from './analytics.service'
import type { IMetricsRepository } from '../../ports/metrics.repository.port'
import type { IGitHubPort } from '../../ports/github.port'
import type { IdentityService } from '../../../identity/application/services/identity.service'
import type { RedisService } from '../../../../infrastructure/cache/redis.service'
import type { Queue } from 'bullmq'

const makeMockMetricsRepo = (): IMetricsRepository => ({
  findRepositoriesByUser: vi.fn(),
  findRepositoryById: vi.fn(),
  findRepositoryByGithubId: vi.fn(),
  upsertRepository: vi.fn(),
  updateRepositorySyncState: vi.fn(),
  setRepositoryTracked: vi.fn(),
  findStaleTrackedRepositories: vi.fn(),
  getDailyMetrics: vi.fn(),
  batchUpsertMetrics: vi.fn(),
  getOrCreateStreak: vi.fn(),
  updateStreak: vi.fn(),
  incrementFreezesUsed: vi.fn(),
  getRepoMetricsTotals: vi.fn().mockResolvedValue([]),
})

function makeService(metricsRepo: IMetricsRepository): AnalyticsService {
  const github = { getUserRepositories: vi.fn() } as unknown as IGitHubPort
  const identityService = { getDecryptedToken: vi.fn() } as unknown as IdentityService
  const redis = {
    getOrSet: vi.fn((_key: string, fn: () => unknown) => fn()),
    delPattern: vi.fn(),
  } as unknown as RedisService
  const syncQueue = { add: vi.fn() } as unknown as Queue

  return new AnalyticsService(github, metricsRepo, identityService, redis, syncQueue)
}

describe('AnalyticsService', () => {
  let metricsRepo: IMetricsRepository
  let service: AnalyticsService

  beforeEach(() => {
    metricsRepo = makeMockMetricsRepo()
    service = makeService(metricsRepo)
  })

  it('getRepositories delegates to metricsRepo.findRepositoriesByUser', async () => {
    const repos: Repository[] = []
    vi.mocked(metricsRepo.findRepositoriesByUser).mockResolvedValue(repos)

    const result = await service.getRepositories('user-1')

    expect(metricsRepo.findRepositoriesByUser).toHaveBeenCalledWith('user-1')
    expect(result).toBe(repos)
  })

  it('getDashboardMetrics fetches via redis.getOrSet and calls getDailyMetrics', async () => {
    const metrics: DailyMetrics[] = []
    vi.mocked(metricsRepo.getDailyMetrics).mockResolvedValue(metrics)

    const from = new Date('2026-01-01')
    const to = new Date('2026-01-31')
    const result = await service.getDashboardMetrics('user-1', from, to)

    expect(metricsRepo.getDailyMetrics).toHaveBeenCalledWith('user-1', from, to)
    expect(result).toBe(metrics)
  })

  it('untrackRepository throws NotFoundException when repo not found', async () => {
    vi.mocked(metricsRepo.findRepositoryById).mockResolvedValue(null)

    await expect(service.untrackRepository('user-1', 'repo-x')).rejects.toThrow('Repository not found')
  })
})
