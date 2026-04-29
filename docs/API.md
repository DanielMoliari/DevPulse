# DevPulse — API Design

## Overview

DevPulse exposes two API surfaces:
1. **GraphQL** — primary interface for the web dashboard (queries + mutations)
2. **REST** — webhook endpoint for GitHub push events and a minimal auth flow

Base URL: `http://localhost:3001/api/v1`
Swagger docs: `http://localhost:3001/api/docs`
GraphQL playground: `http://localhost:3001/api/graphql`

---

## Authentication

All authenticated endpoints require a Bearer JWT in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

JWTs are issued after completing GitHub OAuth flow and expire per `JWT_EXPIRES_IN` (default `7d`). Refresh tokens are not implemented in v1 — users re-authenticate.

### Auth Flow

```
1. Frontend → GET /api/v1/auth/github
        │
        └─► Redirect to github.com/login/oauth/authorize
                │
                └─► GitHub → GET /api/v1/auth/github/callback?code=xxx
                        │
                        └─► API issues JWT
                                │
                                └─► Redirect to /dashboard?token=xxx
```

---

## GraphQL Schema

```graphql
# ─── Scalars ──────────────────────────────────────────────────────────────────
scalar DateTime
scalar Date
scalar JSON

# ─── Enums ────────────────────────────────────────────────────────────────────
enum Plan {
  FREE
  PRO
  TEAM
}

enum SyncState {
  IDLE
  SYNCING
  ERROR
}

# ─── Types ────────────────────────────────────────────────────────────────────
type User {
  id: ID!
  name: String
  email: String
  avatarUrl: String
  plan: Plan!
  githubUsername: String!
  createdAt: DateTime!
  streak: StreakRecord
  repositories: [Repository!]!
  recentMetrics(days: Int = 30): [DailyMetrics!]!
}

type Repository {
  id: ID!
  fullName: String!
  language: String
  isTracked: Boolean!
  lastSyncedAt: DateTime
  syncState: SyncState!
  metrics(from: Date!, to: Date!): [DailyMetrics!]!
}

type DailyMetrics {
  id: ID!
  date: Date!
  repository: Repository
  commits: Int!
  additions: Int!
  deletions: Int!
  prsOpened: Int!
  prsMerged: Int!
  reviewsDone: Int!
  # derived
  netLines: Int!           # additions - deletions
  churnRatio: Float        # deletions / (additions + deletions)
}

type StreakRecord {
  currentStreak: Int!
  longestStreak: Int!
  lastActiveDate: Date
  freezesRemaining: Int!
}

type WeeklyDigest {
  id: ID!
  weekStart: Date!
  summary: DigestSummary!
  sentAt: DateTime
}

type DigestSummary {
  totalCommits: Int!
  totalAdditions: Int!
  totalDeletions: Int!
  totalPrsOpened: Int!
  totalPrsMerged: Int!
  totalReviewsDone: Int!
  activeDays: Int!
  topRepository: String
  streakChange: Int!         # positive = streak grew, negative = broke
}

type SyncResult {
  repositoryId: ID!
  metricsIngested: Int!
  syncedAt: DateTime!
}

type AuthPayload {
  accessToken: String!
  expiresAt: DateTime!
  user: User!
}

# ─── Queries ──────────────────────────────────────────────────────────────────
type Query {
  # Identity
  me: User

  # Analytics
  repository(id: ID!): Repository
  repositories: [Repository!]!

  metrics(
    from: Date!
    to: Date!
    repositoryId: ID         # null = aggregate across all repos
  ): [DailyMetrics!]!

  streak: StreakRecord

  heatmap(year: Int): [HeatmapDay!]!  # GitHub-style contribution heatmap

  # Notifications
  weeklyDigests(limit: Int = 10): [WeeklyDigest!]!
  latestDigest: WeeklyDigest
}

type HeatmapDay {
  date: Date!
  count: Int!     # total commits that day
  level: Int!     # 0–4 (0=none, 4=very active) — matches GitHub palette
}

# ─── Mutations ────────────────────────────────────────────────────────────────
type Mutation {
  # Analytics — repository management
  trackRepository(githubRepoId: String!): Repository!
  untrackRepository(id: ID!): Boolean!
  syncRepository(id: ID!): SyncResult!
  syncAllRepositories: [SyncResult!]!

  # Notifications preferences
  updateDigestPreferences(enabled: Boolean!, dayOfWeek: Int): User!
}

# ─── Subscriptions (v2) ───────────────────────────────────────────────────────
# type Subscription {
#   syncProgress(repositoryId: ID!): SyncProgressEvent
#   streakUpdated: StreakRecord
# }
```

---

## REST Endpoints

### Auth

| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/auth/github`                    | Initiate GitHub OAuth flow           |
| GET    | `/auth/github/callback`           | GitHub OAuth callback (issues JWT)   |
| POST   | `/auth/logout`                    | Invalidate current JWT               |

### GitHub Webhooks

| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| POST   | `/webhooks/github`                | Receive GitHub push/PR events        |

**Webhook payload processing:**

```
POST /api/v1/webhooks/github
Headers:
  X-GitHub-Event: push | pull_request | pull_request_review
  X-Hub-Signature-256: sha256=<hmac>
  Content-Type: application/json
```

Verification flow:
1. Check `X-Hub-Signature-256` — HMAC-SHA256 over raw body with webhook secret
2. Reject with `401` if signature invalid
3. Look up repository by `repository.full_name`
4. Enqueue `SyncRepositoryJob` with the event payload
5. Return `202 Accepted` immediately (webhook must respond < 10s)

### Health

| Method | Path          | Description                  |
|--------|---------------|------------------------------|
| GET    | `/health`     | API health check             |

---

## Rate Limiting Strategy

### GitHub API Limits
- **Authenticated REST API:** 5,000 requests/hour per user token
- **GraphQL API:** 5,000 points/hour (complex queries cost more)
- **Search API:** 30 requests/minute

### DevPulse Rate Limit Budget

```
Per-user hourly budget: 5,000 req
─────────────────────────────────────────────
Initial sync (full history):
  - Repos list:           1 req
  - Commits per repo:     ~10 req/repo (pagination, 100/page)
  - PRs per repo:         ~5 req/repo
  - Reviews per repo:     ~5 req/repo
  Total for 10 repos:     ~210 req (4.2% of budget)

Daily incremental sync (last 24h):
  - Per repo:             ~3 req
  - Total for 10 repos:   ~30 req (0.6% of budget)

On-demand (user triggers sync):
  - Same as daily sync
  - Rate-limited to 1 manual sync per repo per 5 minutes
```

### Implementation

```typescript
// Redis-backed rate limiter per user token
interface GitHubRateLimitState {
  remaining: number
  resetAt: Date
  used: number
}

// Strategy:
// 1. Check X-RateLimit-Remaining header on every response
// 2. If remaining < 100 → pause all sync jobs for that user until resetAt
// 3. Store state in Redis: github:ratelimit:{userId}
// 4. Exponential backoff on 429: 1s → 2s → 4s → 8s (max 4 retries)
// 5. Use conditional requests (If-None-Match + ETags) to save quota
//    on unchanged resources
```

### NestJS Throttler (API-level)

```typescript
// Applied globally in AppModule
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000,  limit: 10  },  // 10 req/s
  { name: 'medium', ttl: 60000, limit: 200 },  // 200 req/min
  { name: 'long', ttl: 3600000, limit: 1000 }, // 1000 req/h
])
```

Webhook endpoint is exempt from throttling (GitHub IPs are allowlisted).

---

## Error Handling

### GraphQL Errors

```json
{
  "errors": [
    {
      "message": "Repository not found",
      "extensions": {
        "code": "NOT_FOUND",
        "repositoryId": "clxyz123"
      }
    }
  ]
}
```

### REST Errors

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "JWT has expired",
  "timestamp": "2026-04-29T12:00:00.000Z",
  "path": "/api/v1/auth/logout"
}
```

### Error Codes

| Code                   | HTTP  | Description                              |
|------------------------|-------|------------------------------------------|
| `UNAUTHORIZED`         | 401   | Missing or invalid JWT                   |
| `FORBIDDEN`            | 403   | Valid JWT but insufficient permissions   |
| `NOT_FOUND`            | 404   | Resource not found                       |
| `RATE_LIMITED`         | 429   | Too many requests                        |
| `GITHUB_RATE_LIMITED`  | 503   | GitHub API quota exhausted               |
| `SYNC_IN_PROGRESS`     | 409   | Sync already running for this repository |
| `PLAN_LIMIT_EXCEEDED`  | 402   | Free plan repository limit reached       |
