import type { DailyMetrics, Repository, Streak } from '@prisma/client'

export interface UpsertMetricsData {
  userId: string
  repoId: string | null
  date: Date
  commits: number
  additions: number
  deletions: number
  prsOpened: number
  prsMerged: number
  reviewsDone: number
}

export interface IMetricsRepository {
  findRepositoriesByUser(userId: string, trackedOnly?: boolean): Promise<Repository[]>
  findRepositoryById(id: string): Promise<Repository | null>
  findRepositoryByGithubId(userId: string, githubRepoId: string): Promise<Repository | null>
  upsertRepository(data: {
    userId: string
    githubRepoId: string
    fullName: string
    language: string | null
    isTracked?: boolean
    isPrivate?: boolean
  }): Promise<Repository>
  updateRepositorySyncState(
    id: string,
    state: 'IDLE' | 'SYNCING' | 'ERROR',
    lastSyncedAt?: Date,
  ): Promise<void>
  setRepositoryTracked(id: string, isTracked: boolean): Promise<void>
  getDailyMetrics(userId: string, from: Date, to: Date, repoId?: string): Promise<DailyMetrics[]>
  batchUpsertMetrics(metrics: UpsertMetricsData[]): Promise<void>
  findStaleTrackedRepositories(olderThanMs: number): Promise<Repository[]>
  getOrCreateStreak(userId: string): Promise<Streak>
  updateStreak(userId: string, data: Partial<Pick<Streak, 'currentStreak' | 'longestStreak' | 'lastActiveDate'>>): Promise<Streak>
}

export const METRICS_REPOSITORY = Symbol('IMetricsRepository')
