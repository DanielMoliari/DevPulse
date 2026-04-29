import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Streak } from '@prisma/client'
import { METRICS_REPOSITORY, type IMetricsRepository } from '../../ports/metrics.repository.port'
import { StreakCalculator } from '../../domain/services/streak.calculator'

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name)

  constructor(
    @Inject(METRICS_REPOSITORY) private readonly metricsRepo: IMetricsRepository,
  ) {}

  async getStreak(userId: string): Promise<Streak> {
    return this.metricsRepo.getOrCreateStreak(userId)
  }

  async recalculate(userId: string): Promise<Streak> {
    const thirtyMonthsAgo = new Date()
    thirtyMonthsAgo.setMonth(thirtyMonthsAgo.getMonth() - 30)

    const metrics = await this.metricsRepo.getDailyMetrics(userId, thirtyMonthsAgo, new Date())
    const activeDates = metrics.filter((m) => m.commits > 0).map((m) => m.date)

    const result = StreakCalculator.calculate(activeDates)

    const updated = await this.metricsRepo.updateStreak(userId, {
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      lastActiveDate: result.lastActiveDate ?? null,
    })

    this.logger.debug(
      `Streak recalculated for ${userId}: current=${result.currentStreak}, longest=${result.longestStreak}`,
    )
    return updated
  }
}
