import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject } from '@nestjs/common'
import type { Job } from 'bullmq'
import { QUEUE_SYNC_REPOSITORY } from '../../../../infrastructure/queue/queue.module'
import { IdentityService } from '../../../identity/application/services/identity.service'
import { GITHUB_PORT, type IGitHubPort } from '../../ports/github.port'
import { METRICS_REPOSITORY, type IMetricsRepository } from '../../ports/metrics.repository.port'
import { StreakService } from '../services/streak.service'
import { AnalyticsService, type SyncJobData } from '../services/analytics.service'

// concurrency=5: GitHub allows 5000 req/hour per user — 5 parallel syncs keeps us well under the cap
// while making a 66-repo backfill finish in ~2 minutes instead of 15.
@Processor(QUEUE_SYNC_REPOSITORY, { concurrency: 5 })
export class SyncRepositoryProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncRepositoryProcessor.name)

  constructor(
    @Inject(GITHUB_PORT) private readonly github: IGitHubPort,
    @Inject(METRICS_REPOSITORY) private readonly metricsRepo: IMetricsRepository,
    private readonly identityService: IdentityService,
    private readonly streakService: StreakService,
    private readonly analyticsService: AnalyticsService,
  ) {
    super()
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    const { userId, repositoryId, fullName } = job.data
    this.logger.log(`Syncing ${fullName} for user ${userId}`)

    await this.metricsRepo.updateRepositorySyncState(repositoryId, 'SYNCING')

    try {
      const accessToken = await this.identityService.getDecryptedToken(userId)
      const [owner, repo] = fullName.split('/') as [string, string]

      const repoRecord = await this.metricsRepo.findRepositoryById(repositoryId)
      // Use lastSyncedAt for incremental syncs; fall back to all-time for first sync
      const since = repoRecord?.lastSyncedAt
        ? new Date(repoRecord.lastSyncedAt.getTime() - 24 * 60 * 60 * 1000) // 1 day overlap to avoid gaps
        : new Date('2008-01-01T00:00:00Z')

      const [commits, pullRequests, reviews] = await Promise.all([
        this.github.getCommitActivity(accessToken, owner, repo, since),
        this.github.getPullRequests(accessToken, owner, repo, since),
        this.github.getReviews(accessToken, owner, repo, since),
      ])

      // Aggregate daily metrics
      const metricsMap = new Map<string, {
        commits: number; additions: number; deletions: number
        prsOpened: number; prsMerged: number; reviewsDone: number
      }>()

      for (const c of commits) {
        const key = c.date.toISOString().slice(0, 10)
        const existing = metricsMap.get(key) ?? { commits: 0, additions: 0, deletions: 0, prsOpened: 0, prsMerged: 0, reviewsDone: 0 }
        existing.commits += c.count
        existing.additions += c.additions
        existing.deletions += c.deletions
        metricsMap.set(key, existing)
      }

      for (const pr of pullRequests) {
        const key = pr.createdAt.toISOString().slice(0, 10)
        const existing = metricsMap.get(key) ?? { commits: 0, additions: 0, deletions: 0, prsOpened: 0, prsMerged: 0, reviewsDone: 0 }
        existing.prsOpened++
        if (pr.mergedAt) {
          const mergeKey = pr.mergedAt.toISOString().slice(0, 10)
          const mergeExisting = metricsMap.get(mergeKey) ?? { commits: 0, additions: 0, deletions: 0, prsOpened: 0, prsMerged: 0, reviewsDone: 0 }
          mergeExisting.prsMerged++
          metricsMap.set(mergeKey, mergeExisting)
        }
        metricsMap.set(key, existing)
      }

      for (const review of reviews) {
        const key = review.submittedAt.toISOString().slice(0, 10)
        const existing = metricsMap.get(key) ?? { commits: 0, additions: 0, deletions: 0, prsOpened: 0, prsMerged: 0, reviewsDone: 0 }
        existing.reviewsDone++
        metricsMap.set(key, existing)
      }

      const metricsToUpsert = Array.from(metricsMap.entries()).map(([dateKey, data]) => ({
        userId,
        repoId: repositoryId,
        date: new Date(dateKey),
        ...data,
      }))

      if (metricsToUpsert.length > 0) {
        await this.metricsRepo.batchUpsertMetrics(metricsToUpsert)
      }

      await this.metricsRepo.updateRepositorySyncState(repositoryId, 'IDLE', new Date())
      await this.streakService.recalculate(userId)
      await this.analyticsService.invalidateDashboardCache(userId)

      this.logger.log(`Sync complete for ${fullName}: ${metricsToUpsert.length} days ingested`)
    } catch (err: unknown) {
      this.logger.error(`Sync failed for ${fullName}`, err)
      await this.metricsRepo.updateRepositorySyncState(repositoryId, 'ERROR')
      throw err
    }
  }
}
