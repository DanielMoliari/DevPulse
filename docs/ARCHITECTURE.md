# DevPulse — Architecture

## Overview

Monorepo (`pnpm workspaces`) with two packages:

| Package | Tech | Port |
|---|---|---|
| `packages/api` | NestJS 11 + Fastify | 17642 |
| `packages/web` | Next.js 15 App Router | 38929 |

The API follows **DDD + Hexagonal Architecture** (ports & adapters). The frontend is a pure client-side SPA for authenticated routes, with SSR only for the two public-facing pages (`/u/[username]`, `/r/[owner]/[repo]`).

---

## API: Bounded Contexts

```
packages/api/src/modules/
├── identity/       — User, GitHub OAuth, JWT, public profile management
├── analytics/      — Repos, metrics, streaks, tech graph, insights, sync pipeline
├── notifications/  — Weekly digest email (Resend), streak alerts
└── webhooks/       — GitHub webhook ingestion (pushes trigger re-sync)
```

Each module follows the same internal layout:

```
<module>/
├── <module>.module.ts
├── application/
│   ├── services/          — orchestration, caching, business logic
│   └── jobs/              — BullMQ processors
├── domain/
│   ├── entities/          — pure TypeScript, no framework deps
│   └── value-objects/
├── graphql/
│   ├── resolvers/         — NestJS @Resolver classes
│   └── types/             — @ObjectType / @InputType / enums
├── infrastructure/
│   ├── persistence/       — Prisma repository implementations
│   ├── github/            — Octokit adapter
│   └── http/              — REST controllers (auth, card image)
└── ports/                 — TypeScript interfaces (IGitHubPort, IMetricsRepository, …)
```

Domain services depend only on port interfaces injected via NestJS DI. They never import adapters or infrastructure directly.

---

## Key Services

### AnalyticsService
Central orchestrator for all analytics. Redis-cached (`getOrSet` helper).

- `getDashboardMetrics(userId, from, to)` — daily metrics aggregated across repos, 5m TTL
- `getTechGraph(userId)` — repo × language constellation data, 1h TTL
- `getLanguageHistory(userId)` — year-over-year language adoption, 1h TTL
- `getHourlyActivity(userId)` — real UTC hour buckets from GitHub commit history, 1h TTL
- `getInsights(userId)` — burnout signal + tech graduations, derived from stored metrics
- `getRepositoryDetail(userId, repoId)` — full repo insights: health score, PR impact, file hotspots, ecosystem connections, curiosities, 10m TTL
- `triggerSync(userId, repoId)` — enqueues BullMQ job, deduped by job ID `sync-{repoId}`
- `scheduledSync()` — 6-hour cron, re-syncs all repos with `lastSyncedAt` older than 6h
- `invalidateDashboardCache(userId)` — called after sync completes

### SyncRepositoryProcessor (BullMQ, concurrency=5)
Ingests one repository's history from GitHub into `DailyMetrics` rows.

1. Sets `syncState = SYNCING`
2. Fetches commits, PRs, reviews from `IGitHubPort` incrementally (since `lastSyncedAt − 1 day`)
3. Aggregates into per-day buckets (`commits`, `additions`, `deletions`, `prsOpened`, `prsMerged`, `reviewsDone`)
4. `batchUpsertMetrics` — upsert on composite unique key `(userId, repoId, date)`
5. Sets `syncState = IDLE`, stamps `lastSyncedAt`, recalculates streak, invalidates Redis cache

### PublicProfileService
Builds and caches the anonymous-readable public profile for `/u/[username]`.

- Checks user's `publicProfile` opt-in flag; returns null if not opted in
- Assembles: top 5 languages from tech graph, last-365-days heatmap, all-time commit total, streak (if `publicShowStreak`), tracked public repos (if `publicShowRepos`)
- Cached in Redis at `public-profile:{username}`, 5m TTL
- `invalidate(username)` called after any public profile pref mutation
- **Redis deserialization trap**: dates come back as JSON strings; coerce to `Date` before GraphQL serialization

### StreakService
Recalculates streak from raw `DailyMetrics` after every sync.

- Uses `StreakCalculator` (pure domain logic, `packages/api/src/modules/analytics/domain/`)
- Upserts `Streak` row, triggers Resend streak alert email when threshold crossed

### GitHubLookupService
Anonymous GitHub API fallback for `searchProfile` and `searchRepo`.

- Used when queried username is not in DevPulse
- Returns top repos, languages, bio, follower count from public GitHub API
- No auth token; subject to 60 req/hour anonymous rate limit

---

## Ports (actual interfaces as implemented)

### IGitHubPort (`analytics/ports/github.port.ts`)
```typescript
getAuthenticatedUser(token: string): Promise<GitHubUserDto>
getUserRepositories(token: string): Promise<GitHubRepoDto[]>        // includes pushed_at
getCommitActivity(token, owner, repo, since): Promise<CommitActivityDto[]>
getPullRequests(token, owner, repo, since): Promise<PullRequestDto[]>
getReviews(token, owner, repo, since): Promise<ReviewDto[]>
getRepositoryInsights(token, owner, repo): Promise<RepoInsightsDto>
getRepositoryLanguages(token, owner, repo): Promise<Record<string,number>>
getRepositoryFileTree(token, owner, repo): Promise<string[]>
getDependencyManifest(token, owner, repo): Promise<string | null>
getCommitHours(token, owner, repo): Promise<number[]>               // 24-element array
```

### IMetricsRepository (`analytics/ports/metrics.repository.port.ts`)
```typescript
findRepositoriesByUser(userId, trackedOnly?): Promise<Repository[]>
findRepositoryById(repoId): Promise<Repository | null>
upsertRepository(data): Promise<Repository>
updateRepositorySyncState(repoId, state, pushedAt?, lastSyncedAt?): Promise<void>
getDailyMetrics(userId, from, to, repoId?): Promise<DailyMetrics[]>
batchUpsertMetrics(metrics[]): Promise<void>
getStreak(userId): Promise<Streak | null>
upsertStreak(userId, data): Promise<Streak>
```

### IUserRepository (`identity/ports/user.repository.port.ts`)
```typescript
findById(id): Promise<User | null>
findByGithubId(githubId): Promise<User | null>
findByUsername(username): Promise<User | null>
upsert(data): Promise<User>
update(id, data): Promise<User>
```

---

## Data Flows

### Authenticated Dashboard Request
```
Frontend (Apollo Client, JWT in Authorization header)
  → POST /api/graphql
  → GqlAuthGuard validates JWT (passport-jwt)
  → GraphQL resolver → AnalyticsService.getDashboardMetrics(userId, from, to)
  → Redis cache check (analytics:dashboard:{userId}:{from}:{to}, 5m TTL)
  → Cache miss: IMetricsRepository.getDailyMetrics → Prisma → PostgreSQL
  → Response marshalled as ObjectType and returned
```

### Repository Sync
```
syncRepository mutation  OR  6-hour cron
  → AnalyticsService.triggerSync → BullMQ enqueue (job ID: sync-{repoId})
  → SyncRepositoryProcessor.process (concurrency=5)
      → updateRepositorySyncState(SYNCING)
      → getDecryptedToken → IGitHubPort × 3 (commits, PRs, reviews)
      → aggregate into per-day map
      → batchUpsertMetrics
      → updateRepositorySyncState(IDLE, lastSyncedAt)
      → StreakService.recalculate
      → AnalyticsService.invalidateDashboardCache
  → Frontend polls repositories query until syncState = IDLE
```

### Public Profile (SSR)
```
Next.js Server Component: /u/[username]/page.tsx
  → ssrGraphQL (plain fetch, no JWT, Next.js ISR revalidate: 60s)
  → publicProfile resolver → PublicProfileService.getPublicProfile
      → Redis cache (public-profile:{username}, 5m TTL)
      → Cache miss: identity.findByUsername, parallel: streak, techGraph, repos, allMetrics
      → Build PublicProfileData, cache it
  → Falls back to GitHubLookupService.lookup for non-DevPulse usernames

og:image (Edge runtime): /u/[username]/opengraph-image
  → Fetches same publicProfile query independently
  → Renders 1200×627 PNG via ImageResponse/Satori (inline styles only, display:flex required)
  → Revalidates every 300s
```

---

## Frontend Architecture

### Data Fetching
- **Apollo Client 4** with `InMemoryCache` for all authenticated data
- `fetchPolicy: 'network-only'` on all metric queries to prevent stale charts
- `resetStore()` called after sync completes to force full refetch
- **ssrGraphQL** (`packages/web/src/lib/graphql-ssr.ts`) — plain `fetch` for public SSR pages only

### State Management
- **Apollo InMemoryCache** — all server state
- **Zustand** (`packages/web/src/store/ui-store.ts`) — sidebar open/collapsed, mobile menu open

### Routing
```
app/
├── page.tsx                    — Marketing landing (public)
├── auth/callback/page.tsx      — OAuth token handler → localStorage → /dashboard
├── u/[username]/
│   ├── page.tsx                — Public profile (SSR, ISR 60s)
│   └── opengraph-image.tsx     — OG image (Edge, revalidate 300s)
├── r/[owner]/[repo]/page.tsx   — Public repo analysis (SSR)
└── (app)/                      — Auth-gated, sidebar layout
    ├── dashboard/page.tsx
    ├── repos/
    │   ├── page.tsx
    │   └── [id]/page.tsx
    ├── streaks/page.tsx
    ├── metrics/page.tsx
    ├── tech/page.tsx
    └── settings/page.tsx
```

### Authentication Guard
`packages/web/src/components/providers.tsx` checks localStorage for JWT. If absent, redirects to `/`. Apollo Client sends it as `Authorization: Bearer {token}` on every request.

---

## Infrastructure

### PostgreSQL 16
Schema tables: `User`, `Repository`, `DailyMetrics`, `Streak`, `WeeklyDigest`, `Webhook`

`DailyMetrics` composite unique key `(userId, repoId, date)` enables idempotent upsert-based incremental sync.

Connection via Prisma 7 + `@prisma/adapter-pg` (explicit driver adapter — `url` is in `prisma.config.ts`, not `schema.prisma`).

### Redis 7
Used for:
- Application cache (10+ namespaces, 5m–2h TTLs)
- BullMQ job queue storage

Key namespaces: `analytics:dashboard:*`, `analytics:tech-graph:*`, `analytics:repo-insight:*`, `analytics:hourly:*`, `analytics:lang-history:*`, `analytics:ecosystem:*`, `analytics:deps:*`, `analytics:file-ownership:*`, `analytics:file-churn:*`, `analytics:repo-prs:*`, `public-profile:*`

### BullMQ
Queue: `QUEUE_SYNC_REPOSITORY`. Job ID: `sync-{repositoryId}` (deduplicates concurrent sync requests for same repo). Worker concurrency: 5.

---

## Security

- **GitHub access tokens** — AES-256-GCM encrypted at rest (`packages/api/src/infrastructure/crypto/`)
- **JWT** — HS256, validated by `passport-jwt` via `GqlAuthGuard` on all authenticated resolvers
- **Public resolvers** (`publicProfile`, `searchProfile`, `searchRepo`) — no auth guard; public by design
- **Rate limiting** — `@nestjs/throttler` on REST endpoints; `@octokit/plugin-throttling` + `plugin-retry` on GitHub API calls
- **Plan limits** — `packages/api/src/modules/identity/domain/plan-limits.ts` enforced at `trackRepository` mutation

---

*Last updated: 2026-05-08*
