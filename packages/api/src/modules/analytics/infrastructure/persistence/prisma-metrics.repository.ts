import { Injectable } from '@nestjs/common'
import type { DailyMetrics, Repository, Streak } from '@prisma/client'
import { PrismaService } from '../../../../infrastructure/database/prisma.service'
import type { IMetricsRepository, UpsertMetricsData } from '../../ports/metrics.repository.port'

@Injectable()
export class PrismaMetricsRepository implements IMetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRepositoriesByUser(userId: string, trackedOnly = false): Promise<Repository[]> {
    return this.prisma.repository.findMany({
      where: { userId, ...(trackedOnly ? { isTracked: true } : {}) },
      orderBy: { lastSyncedAt: 'desc' },
    })
  }

  findRepositoryById(id: string): Promise<Repository | null> {
    return this.prisma.repository.findUnique({ where: { id } })
  }

  findRepositoryByGithubId(userId: string, githubRepoId: string): Promise<Repository | null> {
    return this.prisma.repository.findUnique({ where: { userId_githubRepoId: { userId, githubRepoId } } })
  }

  upsertRepository(data: {
    userId: string
    githubRepoId: string
    fullName: string
    language: string | null
    isTracked?: boolean
  }): Promise<Repository> {
    const { isTracked = true, ...rest } = data
    return this.prisma.repository.upsert({
      where: { userId_githubRepoId: { userId: data.userId, githubRepoId: data.githubRepoId } },
      create: { ...rest, isTracked },
      update: { fullName: data.fullName, language: data.language },
    })
  }

  async updateRepositorySyncState(
    id: string,
    state: 'IDLE' | 'SYNCING' | 'ERROR',
    lastSyncedAt?: Date,
  ): Promise<void> {
    await this.prisma.repository.update({
      where: { id },
      data: { syncState: state, ...(lastSyncedAt ? { lastSyncedAt } : {}) },
    })
  }

  async setRepositoryTracked(id: string, isTracked: boolean): Promise<void> {
    await this.prisma.repository.update({ where: { id }, data: { isTracked } })
  }

  getDailyMetrics(userId: string, from: Date, to: Date, repoId?: string): Promise<DailyMetrics[]> {
    return this.prisma.dailyMetrics.findMany({
      where: {
        userId,
        date: { gte: from, lte: to },
        ...(repoId ? { repoId } : {}),
      },
      orderBy: { date: 'asc' },
    })
  }

  async batchUpsertMetrics(metrics: UpsertMetricsData[]): Promise<void> {
    await this.prisma.$transaction(
      metrics.map((m) =>
        this.prisma.dailyMetrics.upsert({
          where: { userId_repoId_date: { userId: m.userId, repoId: m.repoId ?? '', date: m.date } },
          create: m,
          update: {
            commits: m.commits,
            additions: m.additions,
            deletions: m.deletions,
            prsOpened: m.prsOpened,
            prsMerged: m.prsMerged,
            reviewsDone: m.reviewsDone,
          },
        }),
      ),
    )
  }

  getOrCreateStreak(userId: string): Promise<Streak> {
    return this.prisma.streak.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
  }

  updateStreak(
    userId: string,
    data: Partial<Pick<Streak, 'currentStreak' | 'longestStreak' | 'lastActiveDate'>>,
  ): Promise<Streak> {
    return this.prisma.streak.update({ where: { userId }, data })
  }
}
