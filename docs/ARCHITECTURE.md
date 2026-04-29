# DevPulse — Architecture

## Hexagonal Architecture (Ports & Adapters)

The API follows a strict Hexagonal Architecture (also known as Ports & Adapters). Business logic lives in the domain core and has zero knowledge of infrastructure. Infrastructure adapters implement port interfaces defined by the domain.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │  GitHub API  │  │  PostgreSQL  │  │  Redis   │  │   Resend   │  │
│  │  (Octokit)   │  │  (Prisma)    │  │  Cache   │  │   Email    │  │
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  └─────┬──────┘  │
│         │                 │               │               │         │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌────▼─────┐  ┌─────▼──────┐  │
│  │  GitHubApi   │  │    Prisma    │  │  Redis   │  │   Resend   │  │
│  │  Adapter     │  │  Repositories│  │  Adapter │  │  Adapter   │  │
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  └─────┬──────┘  │
│         │                 │               │               │         │
├─────────┼─────────────────┼───────────────┼───────────────┼─────────┤
│         │          PORTS (Interfaces)      │               │         │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌────▼─────┐  ┌─────▼──────┐  │
│  │ IGitHubPort  │  │ IMetricsRepo │  │ ICachePort│  │ INotifPort │  │
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  └─────┬──────┘  │
│         │                 │               │               │         │
├─────────┼─────────────────┼───────────────┼───────────────┼─────────┤
│         │           DOMAIN CORE            │               │         │
│  ┌──────▼─────────────────▼───────────────▼───────────────▼──────┐  │
│  │                                                                 │  │
│  │  Analytics Service  │  Streak Service  │  Digest Service       │  │
│  │  ─────────────────────────────────────────────────────────     │  │
│  │  User Aggregate     │  Repository Aggregate                    │  │
│  │  DailyMetrics Agg   │  WeeklyDigest Aggregate                  │  │
│  │  ─────────────────────────────────────────────────────────     │  │
│  │  Domain Events: UserConnectedGitHub, RepositorySynced, ...     │  │
│  │                                                                 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    DRIVING ADAPTERS (Inputs)                         │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │  GraphQL     │  │  REST (GitHub │  │  BullMQ Job Queue        │  │
│  │  Resolvers   │  │  Webhooks)    │  │  (sync scheduler)        │  │
│  └──────────────┘  └───────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## NestJS Module Structure

Each NestJS module maps 1:1 to a bounded context or infrastructure concern.

```
packages/api/src/
├── main.ts
├── app.module.ts
│
├── modules/
│   ├── identity/                    # Identity bounded context
│   │   ├── identity.module.ts
│   │   ├── domain/
│   │   │   ├── entities/user.entity.ts
│   │   │   ├── value-objects/github-profile.vo.ts
│   │   │   └── events/user-connected-github.event.ts
│   │   ├── application/
│   │   │   ├── commands/connect-github.command.ts
│   │   │   └── queries/get-current-user.query.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/prisma-user.repository.ts
│   │   │   └── http/auth.controller.ts
│   │   └── ports/
│   │       └── user.repository.port.ts
│   │
│   ├── analytics/                   # Analytics bounded context
│   │   ├── analytics.module.ts
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── repository.entity.ts
│   │   │   │   └── daily-metrics.entity.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── commit-stats.vo.ts
│   │   │   │   ├── review-stats.vo.ts
│   │   │   │   └── streak-record.vo.ts
│   │   │   └── events/
│   │   │       ├── repository-synced.event.ts
│   │   │       └── streak-broken.event.ts
│   │   ├── application/
│   │   │   ├── services/
│   │   │   │   ├── analytics.service.ts
│   │   │   │   └── streak.service.ts
│   │   │   └── jobs/
│   │   │       └── sync-repository.job.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── prisma-metrics.repository.ts
│   │   │   │   └── prisma-repository.repository.ts
│   │   │   └── github/
│   │   │       └── github-api.adapter.ts
│   │   └── ports/
│   │       ├── github.port.ts
│   │       └── metrics.repository.port.ts
│   │
│   ├── notifications/               # Notifications bounded context
│   │   ├── notifications.module.ts
│   │   ├── domain/
│   │   │   └── entities/weekly-digest.entity.ts
│   │   ├── application/
│   │   │   └── services/digest.service.ts
│   │   ├── infrastructure/
│   │   │   └── email/resend.adapter.ts
│   │   └── ports/
│   │       └── notification.service.port.ts
│   │
│   └── billing/                     # Billing bounded context
│       ├── billing.module.ts
│       ├── domain/
│       │   └── value-objects/plan.vo.ts
│       └── application/
│           └── services/billing.service.ts
│
├── infrastructure/                  # Shared infrastructure
│   ├── database/
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   ├── cache/
│   │   ├── redis.service.ts
│   │   └── redis.module.ts
│   ├── queue/
│   │   └── queue.module.ts
│   └── crypto/
│       └── encryption.service.ts    # AES-256-GCM for tokens
│
└── graphql/                         # GraphQL layer
    ├── schema.gql
    └── resolvers/
        ├── user.resolver.ts
        ├── repository.resolver.ts
        └── metrics.resolver.ts
```

---

## Ports (Interfaces)

### IGitHubPort
```typescript
// ports/github.port.ts
export interface IGitHubPort {
  getAuthenticatedUser(accessToken: string): Promise<GitHubUserDto>
  getUserRepositories(accessToken: string): Promise<GitHubRepoDto[]>
  getCommitActivity(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
    until: Date,
  ): Promise<CommitActivityDto[]>
  getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<PullRequestDto[]>
  getReviews(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<ReviewDto[]>
  registerWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookUrl: string,
    events: string[],
  ): Promise<GitHubWebhookDto>
}

export const GITHUB_PORT = Symbol('IGitHubPort')
```

### IMetricsRepository
```typescript
// ports/metrics.repository.port.ts
export interface IMetricsRepository {
  findByUserAndDateRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<DailyMetrics[]>
  findByUserAndRepo(
    userId: string,
    repositoryId: string,
    from: Date,
    to: Date,
  ): Promise<DailyMetrics[]>
  upsertDailyMetrics(metrics: DailyMetrics): Promise<void>
  batchUpsert(metrics: DailyMetrics[]): Promise<void>
  getStreakForUser(userId: string): Promise<StreakRecord | null>
  updateStreak(userId: string, streak: StreakRecord): Promise<void>
}

export const METRICS_REPOSITORY_PORT = Symbol('IMetricsRepository')
```

### INotificationService
```typescript
// ports/notification.service.port.ts
export interface INotificationService {
  sendWeeklyDigest(
    userId: string,
    email: string,
    digest: DigestSummary,
  ): Promise<void>
  sendStreakAlert(
    userId: string,
    email: string,
    streakLength: number,
  ): Promise<void>
  sendMilestoneReached(
    userId: string,
    email: string,
    milestone: string,
  ): Promise<void>
}

export const NOTIFICATION_SERVICE_PORT = Symbol('INotificationService')
```

---

## Adapters (Implementations)

### GitHubApiAdapter
- Uses `@octokit/rest` under the hood
- Applies exponential backoff on 429 (rate limit exceeded)
- Caches responses in Redis with TTL matching GitHub's `Cache-Control` headers
- Translates Octokit types → domain DTOs

### PrismaMetricsRepository
- Implements `IMetricsRepository` using Prisma Client
- Uses `upsert` with composite unique keys for idempotent ingestion
- Batch operations use `$transaction` for atomicity

### ResendNotificationAdapter
- Implements `INotificationService` using Resend SDK
- Templates stored as React Email components
- Tracks delivery status in `weekly_digests.sentAt`

### RedisCacheAdapter
- Generic TTL-based cache wrapper
- Key strategy: `{context}:{entityType}:{id}:{qualifier}`
- Example: `analytics:github:user123:repos`

---

## Dependency Injection (NestJS)

Adapters are bound to port symbols in each module's `providers` array:

```typescript
// analytics.module.ts
@Module({
  providers: [
    {
      provide: GITHUB_PORT,
      useClass: GitHubApiAdapter,
    },
    {
      provide: METRICS_REPOSITORY_PORT,
      useClass: PrismaMetricsRepository,
    },
    AnalyticsService,
    StreakService,
  ],
})
export class AnalyticsModule {}
```

Domain services receive ports via constructor injection and never import adapters directly.

---

## Data Flow: Repository Sync

```
1. Cron / Webhook trigger
        │
        ▼
2. SyncRepositoryJob (queue consumer)
        │
        ▼
3. AnalyticsService.syncRepository(userId, repoId)
        │
        ├─► IGitHubPort.getCommitActivity(...)   ← GitHub API
        ├─► IGitHubPort.getPullRequests(...)      ← GitHub API
        │
        ▼
4. Build DailyMetrics aggregates from raw data
        │
        ▼
5. IMetricsRepository.batchUpsert(metrics)        ← PostgreSQL
        │
        ▼
6. StreakService.recalculate(userId)
        │
        ├─ if streak broken → emit StreakBroken event
        │
        ▼
7. Emit RepositorySynced domain event
        │
        └─► Notifications context listener        ← async
```

---

## Security Considerations

- **GitHub access tokens** encrypted with AES-256-GCM before storage (key from `JWT_SECRET` derivative via HKDF)
- **Webhook signatures** verified via HMAC-SHA256 before any payload processing
- **JWT** signed with RS256 in production; HS256 acceptable in development
- **Rate limiting** applied at the API gateway level (Fastify + `@nestjs/throttler`)
- All cross-context communication via domain events — no direct module imports across bounded context boundaries
