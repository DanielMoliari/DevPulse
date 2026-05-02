// Mirror of the backend's PLAN_LIMITS constant. Kept in sync manually because the
// frontend does not import from `@devpulse/api`. If you add a tier here, also
// update `packages/api/src/modules/identity/domain/plan-limits.ts`.
import type { Plan } from '@/graphql/types'

export const PLAN_LIMITS: Record<Plan, { maxTrackedRepos: number }> = {
  FREE: { maxTrackedRepos: 5 },
  PRO: { maxTrackedRepos: 100 },
  TEAM: { maxTrackedRepos: 500 },
}
