// Single source of truth for plan-based feature gating. Adapters (services, resolvers)
// should consult these constants rather than hard-coding limits, so swapping the table
// (or layering Stripe metadata on top later) only requires touching this file.
export const PLAN_LIMITS = {
  FREE: { maxTrackedRepos: 5, weeklyDigest: true, publicProfile: true, customDomain: false },
  PRO: { maxTrackedRepos: 100, weeklyDigest: true, publicProfile: true, customDomain: true },
  TEAM: { maxTrackedRepos: 500, weeklyDigest: true, publicProfile: true, customDomain: true },
} as const

export type PlanLimits = (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS]
