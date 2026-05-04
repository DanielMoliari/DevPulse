import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { QUEUE_SYNC_REPOSITORY } from '../../infrastructure/queue/queue.module'
import { IdentityModule } from '../identity/identity.module'
import { GitHubApiAdapter } from './infrastructure/github/github-api.adapter'
import { PrismaMetricsRepository } from './infrastructure/persistence/prisma-metrics.repository'
import { CardController } from './infrastructure/http/card.controller'
import { GITHUB_PORT } from './ports/github.port'
import { METRICS_REPOSITORY } from './ports/metrics.repository.port'
import { AnalyticsService } from './application/services/analytics.service'
import { PublicProfileService } from './application/services/public-profile.service'
import { StreakService } from './application/services/streak.service'
import { SyncRepositoryProcessor } from './application/jobs/sync-repository.processor'
import { AnalyticsResolver } from './graphql/resolvers/analytics.resolver'
import { PublicProfileResolver } from './graphql/resolvers/public-profile.resolver'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_SYNC_REPOSITORY }),
    IdentityModule,
  ],
  controllers: [CardController],
  providers: [
    AnalyticsService,
    StreakService,
    PublicProfileService,
    SyncRepositoryProcessor,
    AnalyticsResolver,
    PublicProfileResolver,
    { provide: GITHUB_PORT, useClass: GitHubApiAdapter },
    { provide: METRICS_REPOSITORY, useClass: PrismaMetricsRepository },
  ],
  exports: [AnalyticsService, StreakService, PublicProfileService],
})
export class AnalyticsModule {}
