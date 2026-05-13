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

  static readonly MAX_FREEZES = 3

  async applyFreeze(userId: string): Promise<{ ok: boolean; reason?: string; streak: Streak }> {
    const streak = await this.metricsRepo.getOrCreateStreak(userId)
    if (streak.currentStreak === 0) {
      return { ok: false, reason: 'No active streak to freeze', streak }
    }
    if (streak.freezesUsed >= StreakService.MAX_FREEZES) {
      return { ok: false, reason: 'No freezes remaining (max 3 used)', streak }
    }
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const lastActive = streak.lastActiveDate ? new Date(streak.lastActiveDate) : null
    if (lastActive) lastActive.setUTCHours(0, 0, 0, 0)
    if (lastActive && lastActive.getTime() === today.getTime()) {
      return { ok: false, reason: 'Already committed today — no freeze needed', streak }
    }
    const updated = await this.metricsRepo.incrementFreezesUsed(userId)
    return { ok: true, streak: updated }
  }

  async recalculate(userId: string): Promise<Streak> {
    const thirtyMonthsAgo = new Date()
    thirtyMonthsAgo.setMonth(thirtyMonthsAgo.getMonth() - 30)

    const metrics = await this.metricsRepo.getDailyMetrics(userId, thirtyMonthsAgo, new Date())
    const activeDates = metrics.filter((m) => m.commits > 0).map((m) => m.date)

    const result = StreakCalculator.calculate(activeDates)

    await this.metricsRepo.getOrCreateStreak(userId)
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
