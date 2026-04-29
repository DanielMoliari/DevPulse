export type Plan = 'FREE' | 'PRO'
export type SyncState = 'IDLE' | 'SYNCING' | 'ERROR'

export interface User {
  id: string
  githubId: string
  username: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  plan: Plan
  createdAt: string
}

export interface Repository {
  id: string
  fullName: string
  language: string | null
  isTracked: boolean
  syncState: SyncState
  lastSyncedAt: string | null
}

export interface DailyMetrics {
  id: string
  date: string
  commits: number
  additions: number
  deletions: number
  prsOpened: number
  prsMerged: number
  reviewsDone: number
  netLines: number
  churnRatio: number | null
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
}

export interface HeatmapDay {
  date: string
  count: number
  level: number
}

export interface SyncResult {
  repositoryId: string
  queued: boolean
}
