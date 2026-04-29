# DevPulse — Domain Design

## Overview

DevPulse follows Domain-Driven Design (DDD) principles, organized into four bounded contexts that reflect real business boundaries. Each context owns its data, has an explicit public interface, and communicates with other contexts only via domain events.

---

## Bounded Contexts

### 1. Identity Context
**Responsibility:** User accounts, GitHub OAuth, session management, and access control.

**Owns:**
- User registration and authentication via GitHub OAuth
- Token storage and refresh
- Plan/subscription status per user
- Session issuance (JWT)

**Public interface (Anti-Corruption Layer):**
- Publishes `UserConnectedGitHub`, `UserDisconnectedGitHub`
- Exposes `UserId` value object consumed by all other contexts

---

### 2. Analytics Context
**Responsibility:** Aggregating and serving developer productivity metrics from GitHub activity.

**Owns:**
- Repository tracking configuration
- Daily metrics ingestion (commits, additions, deletions, PRs, reviews)
- Streak calculation and maintenance
- Historical data querying

**Public interface:**
- Publishes `RepositorySynced`, `StreakUpdated`, `StreakBroken`
- Consumes `UserConnectedGitHub` to initialize repository sync

---

### 3. Notifications Context
**Responsibility:** Weekly digest generation, streak alerts, and milestone notifications.

**Owns:**
- Digest scheduling and delivery
- Alert rules (streak at risk, PR review pending)
- Notification preferences per user

**Public interface:**
- Publishes `DigestSent`, `AlertTriggered`
- Consumes `StreakBroken`, `RepositorySynced`, `WeekBoundaryReached`

---

### 4. Billing Context
**Responsibility:** Plan management, subscription lifecycle, and feature gating.

**Owns:**
- Plan definitions (Free, Pro, Team)
- Subscription state per user
- Usage limit enforcement

**Public interface:**
- Publishes `PlanUpgraded`, `PlanDowngraded`, `TrialExpired`
- Consumes `UserConnectedGitHub` to initialize free plan

---

## Aggregates

### User Aggregate
**Root:** `User`
**Cluster:** `User` + `GitHubProfile` + `StreakRecord`

```
User
├── id: UserId
├── email: Email (optional)
├── name: string
├── plan: Plan (FREE | PRO | TEAM)
├── createdAt: Date
├── githubProfile: GitHubProfile        ← Value Object
└── streak: StreakRecord                 ← Value Object
```

**Invariants:**
- A user must have a valid `GitHubProfile` before any analytics are collected
- A user on `FREE` plan cannot track more than 3 repositories
- `streak.lastActiveDate` must never be in the future

**Methods:**
- `connectGitHub(profile: GitHubProfile): UserConnectedGitHub`
- `disconnectGitHub(): UserDisconnectedGitHub`
- `upgradePlan(plan: Plan): PlanUpgraded`

---

### Repository Aggregate
**Root:** `Repository`
**Cluster:** `Repository` + `SyncState`

```
Repository
├── id: RepositoryId
├── userId: UserId
├── githubRepoId: string
├── fullName: string          ← "owner/repo"
├── language: string | null
├── isTracked: boolean
├── lastSyncedAt: Date | null
└── syncState: SyncState      ← Value Object (IDLE | SYNCING | ERROR)
```

**Invariants:**
- `fullName` must match the pattern `owner/repo`
- A repository can only be tracked by the user who added it
- `lastSyncedAt` is null until first successful sync

**Methods:**
- `startTracking(): void`
- `stopTracking(): void`
- `recordSync(syncedAt: Date): RepositorySynced`
- `recordSyncError(error: string): void`

---

### DailyMetrics Aggregate
**Root:** `DailyMetrics`
**Cluster:** `DailyMetrics` + `CommitStats` + `ReviewStats`

```
DailyMetrics
├── id: MetricsId
├── userId: UserId
├── repositoryId: RepositoryId | null  ← null = cross-repo aggregate
├── date: CalendarDate
├── commitStats: CommitStats            ← Value Object
└── reviewStats: ReviewStats            ← Value Object
```

**Invariants:**
- Only one `DailyMetrics` record per `(userId, repositoryId, date)` tuple
- All numeric fields must be >= 0
- `date` must not be in the future

---

### WeeklyDigest Aggregate
**Root:** `WeeklyDigest`

```
WeeklyDigest
├── id: DigestId
├── userId: UserId
├── weekStart: CalendarDate   ← always a Monday
├── summary: DigestSummary    ← Value Object
└── sentAt: Date | null
```

**Invariants:**
- Only one digest per `(userId, weekStart)` pair
- `sentAt` is set once and never updated
- `weekStart` must be a Monday

---

## Value Objects

### GitHubProfile
```typescript
interface GitHubProfile {
  readonly githubId: string
  readonly username: string
  readonly avatarUrl: string
  readonly profileUrl: string
  readonly accessToken: string      // AES-256-GCM encrypted at rest
  readonly scopes: readonly string[]
  readonly tokenExpiresAt: Date | null
}
```
**Equality:** by `githubId`
**Validation:** `githubId` must be non-empty; `username` must match `/^[a-zA-Z0-9-]+$/`

---

### CommitStats
```typescript
interface CommitStats {
  readonly count: number        // total commits that day
  readonly additions: number    // lines added
  readonly deletions: number    // lines deleted
  readonly repositories: number // distinct repos with commits
}
```
**Equality:** structural
**Derived:** `churnRatio = deletions / (additions + deletions)` — values in [0, 1]

---

### ReviewStats
```typescript
interface ReviewStats {
  readonly prsOpened: number
  readonly prsMerged: number
  readonly reviewsDone: number
  readonly commentsLeft: number
  readonly reviewCycleAvgHours: number | null
}
```
**Equality:** structural

---

### StreakRecord
```typescript
interface StreakRecord {
  readonly currentStreak: number   // consecutive active days
  readonly longestStreak: number   // all-time record
  readonly lastActiveDate: Date | null
  readonly freezesRemaining: number // Pro feature — skip a day
}
```
**Equality:** by `currentStreak + lastActiveDate`
**Invariant:** `currentStreak <= longestStreak`

---

## Domain Events

All events are immutable, named in past tense, and carry enough data for any subscriber to act without additional queries.

### UserConnectedGitHub
```typescript
interface UserConnectedGitHub {
  readonly eventType: 'UserConnectedGitHub'
  readonly occurredAt: Date
  readonly userId: string
  readonly githubUsername: string
  readonly githubId: string
  readonly scopes: string[]
}
```
**Triggers:** Analytics context initializes repository discovery; Billing context assigns free plan.

---

### RepositorySynced
```typescript
interface RepositorySynced {
  readonly eventType: 'RepositorySynced'
  readonly occurredAt: Date
  readonly userId: string
  readonly repositoryId: string
  readonly fullName: string
  readonly syncedDateRange: { from: Date; to: Date }
  readonly metricsIngested: number
}
```
**Triggers:** Streak recalculation; digest data refresh.

---

### StreakBroken
```typescript
interface StreakBroken {
  readonly eventType: 'StreakBroken'
  readonly occurredAt: Date
  readonly userId: string
  readonly brokenStreakLength: number
  readonly lastActiveDate: Date
}
```
**Triggers:** Notifications context sends streak-broken alert.

---

### DigestSent
```typescript
interface DigestSent {
  readonly eventType: 'DigestSent'
  readonly occurredAt: Date
  readonly userId: string
  readonly digestId: string
  readonly weekStart: Date
  readonly channel: 'email' | 'webhook'
}
```
**Triggers:** Analytics context marks digest as delivered.

---

## Context Map

```
┌─────────────────┐       UserConnectedGitHub        ┌──────────────────┐
│  Identity       │ ──────────────────────────────► │  Analytics       │
│  Context        │                                  │  Context         │
│                 │ ◄────────────────────────────── │                  │
└─────────────────┘       (UserId lookups via ACL)   └────────┬─────────┘
        │                                                     │
        │ PlanUpgraded                          RepositorySynced
        ▼                                       StreakBroken
┌─────────────────┐                             │
│  Billing        │                             ▼
│  Context        │              ┌──────────────────────┐
│                 │              │  Notifications       │
│                 │              │  Context             │
└─────────────────┘              │                      │
                                 └──────────────────────┘
```

**Relationship types:**
- Identity → Analytics: **Published Language** (domain events)
- Identity → Billing: **Published Language** (domain events)
- Analytics → Notifications: **Published Language** (domain events)
- Billing → Analytics: **Conformist** (Analytics respects plan limits from Billing)
