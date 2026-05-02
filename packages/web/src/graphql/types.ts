export type Plan = 'FREE' | 'PRO' | 'TEAM'
export type SyncState = 'IDLE' | 'SYNCING' | 'ERROR'

export interface User {
  id: string
  githubId: string
  username: string | null
  name: string | null
  email: string | null
  avatarUrl: string | null
  plan: Plan
  notificationsEnabled: boolean
  streakAlertsEnabled: boolean
  publicProfile: boolean
  publicShowRepos: boolean
  publicShowStreak: boolean
  createdAt: string
}

export interface PublicProfileLanguage {
  name: string
  bytes: number
  percent: number
}

export interface PublicProfileRepo {
  fullName: string
  language: string | null
}

export interface PublicProfile {
  username: string
  displayName: string
  avatarUrl: string | null
  joinedAt: string
  activeDays: number
  totalCommits: number
  currentStreak: number | null
  longestStreak: number | null
  topLanguages: PublicProfileLanguage[]
  recentActivity: HeatmapDay[]
  trackedRepos: PublicProfileRepo[] | null
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

export interface HourlyActivity {
  hours: number[]
  peakHour: number
  peakRatio: number
}

export interface BurnoutSignal {
  atRisk: boolean
  consecutiveDays: number
  netLinesTrend: number
  message: string
}

export interface TechGraduation {
  from: string
  to: string
  year: number
  confidence: number
  message: string
}

export interface Insights {
  hourlyActivity: HourlyActivity | null
  burnout: BurnoutSignal | null
  techGraduations: TechGraduation[]
}
