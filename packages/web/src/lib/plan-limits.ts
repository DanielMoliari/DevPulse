// Mirror of the backend's PLAN_LIMITS constant. Kept in sync manually because the
// frontend does not import from `@devpulse/api`. If you add a tier here, also
// update `packages/api/src/modules/identity/domain/plan-limits.ts`.
import type { Plan } from '@/graphql/types'

export const PLAN_LIMITS: Record<Plan, {
  maxTrackedRepos: null           // null = unlimited on all plans
  historyDays: number | null      // null = all-time; 90 = 90-day window for FREE
  yearInCode: boolean
  rankPills: boolean
  streakFreezes: number | null    // null = unlimited
}> = {
  FREE: {
    maxTrackedRepos: null,
    historyDays: 90,
    yearInCode: false,
    rankPills: false,
    streakFreezes: 1,
  },
  PRO: {
    maxTrackedRepos: null,
    historyDays: null,
    yearInCode: true,
    rankPills: true,
    streakFreezes: null,
  },
  TEAM: {
    maxTrackedRepos: null,
    historyDays: null,
    yearInCode: true,
    rankPills: true,
    streakFreezes: null,
  },
}
