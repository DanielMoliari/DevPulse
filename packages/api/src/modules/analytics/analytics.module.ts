import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { QUEUE_SYNC_REPOSITORY } from '../../infrastructure/queue/queue.module'
import { IdentityModule } from '../identity/identity.module'
import { GitHubApiAdapter } from './infrastructure/github/github-api.adapter'
import { PrismaMetricsRepository } from './infrastructure/persistence/prisma-metrics.repository'
import { GITHUB_PORT } from './ports/github.port'
import { METRICS_REPOSITORY } from './ports/metrics.repository.port'
import { AnalyticsService } from './application/services/analytics.service'
import { StreakService } from './application/services/streak.service'
import { SyncRepositoryProcessor } from './application/jobs/sync-repository.processor'
import { AnalyticsResolver } from './graphql/resolvers/analytics.resolver'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_SYNC_REPOSITORY }),
    IdentityModule,
  ],
  providers: [
    AnalyticsService,
    StreakService,
    SyncRepositoryProcessor,
    AnalyticsResolver,
    { provide: GITHUB_PORT, useClass: GitHubApiAdapter },
    { provide: METRICS_REPOSITORY, useClass: PrismaMetricsRepository },
  ],
  exports: [AnalyticsService, StreakService],
})
export class AnalyticsModule {}
