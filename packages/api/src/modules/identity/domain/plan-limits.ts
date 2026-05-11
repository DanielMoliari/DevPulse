// Single source of truth for plan-based feature gating. Adapters (services, resolvers)
// should consult these constants rather than hard-coding limits, so swapping the table
// (or layering Stripe metadata on top later) only requires touching this file.
export const PLAN_LIMITS = {
  FREE: {
    maxTrackedRepos: null,   // null = unlimited
    historyDays: 90,         // 90-day rolling window on metrics queries
    weeklyDigest: true,
    publicProfile: true,
    customDomain: false,
    streakFreezes: 1,        // FREE gets 1 lifetime freeze, PRO gets unlimited
    yearInCode: false,       // Year in Code full view is PRO+
    rankPills: false,        // rank % pills on public profile are PRO+
  },
  PRO: {
    maxTrackedRepos: null,   // null = unlimited
    historyDays: null,       // null = all-time
    weeklyDigest: true,
    publicProfile: true,
    customDomain: true,
    streakFreezes: null,     // unlimited
    yearInCode: true,
    rankPills: true,
  },
  TEAM: {
    maxTrackedRepos: null,
    historyDays: null,
    weeklyDigest: true,
    publicProfile: true,
    customDomain: true,
    streakFreezes: null,
    yearInCode: true,
    rankPills: true,
  },
} as const

export type PlanLimits = (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS]
