# DevPulse

**Strava for developers — commit streaks, PR throughput, and contribution insights from your GitHub activity.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Commit streak tracking** — daily coding streaks with current/longest streak display and full-year contribution calendar
- **GitHub contribution heatmap** — visualize your activity intensity across the year at a glance
- **PR throughput charts** — track pull requests opened and merged over custom date ranges
- **Code volume & churn ratio** — net lines added/removed and churn ratio to measure effective output
- **Language distribution** — see which languages you spend the most time in across all tracked repositories
- **Activity by hour** — identify your peak coding hours from historical commit data
- **Dark-first Linear-inspired UI** — clean, distraction-free dashboard with violet accents and Spotify Wrapped-style achievement cards for milestone moments

---

## Architecture

```
┌──────────────┐        ┌─────────────────────────────┐
│              │        │       NestJS API :17642        │
│   Browser    │──────▶ │  (Fastify + GraphQL/REST)    │
│              │        │                               │
│  Next.js     │        │  ┌─────────────────────────┐ │
│  :38929       │        │  │  Bounded Contexts        │ │
│              │        │  │  · Identity              │ │
│  Apollo      │        │  │  · Analytics             │ │
│  Client      │        │  │  · Notifications         │ │
└──────────────┘        │  │  · Billing               │ │
                        │  └─────────────────────────┘ │
                        │              │                │
                        └──────────────┼────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
              ┌─────▼──────┐   ┌──────▼─────┐   ┌────────▼───────┐
              │ PostgreSQL │   │   Redis    │   │  GitHub API    │
              │    :5432   │   │   :6379    │   │  (Octokit)     │
              └────────────┘   └────────────┘   └────────────────┘
```

The API follows **hexagonal (ports & adapters) architecture** across four bounded contexts: Identity, Analytics, Notifications, and Billing. Domain logic depends only on port interfaces — adapters (Prisma, Redis, Octokit) are injected at the infrastructure layer. The GraphQL API handles all analytics queries; REST endpoints are reserved for GitHub OAuth callbacks and webhooks.

---

## Quick Start

```bash
# Prerequisites: Node 22, pnpm 10, Docker
git clone https://github.com/your-username/devpulse.git
cd devpulse
cp .env.example .env        # fill in GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET
docker compose up -d        # postgres + redis
pnpm install
pnpm --filter api exec prisma migrate deploy
pnpm --filter api seed      # optional: load demo data
pnpm dev                    # web :38929 + api :17642
```

Once running:
- Dashboard: http://localhost:38929
- API (GraphQL Playground): http://localhost:17642/api/graphql
- API (Swagger / REST docs): http://localhost:17642/api/docs

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | — | `development` \| `production` |
| `DATABASE_URL` | yes | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `REDIS_URL` | yes | Redis connection string (`redis://localhost:6379`) |
| `GITHUB_CLIENT_ID` | yes | GitHub OAuth App client ID — create at github.com/settings/developers |
| `GITHUB_CLIENT_SECRET` | yes | GitHub OAuth App client secret |
| `GITHUB_CALLBACK_URL` | yes | Must match the callback URL registered in your GitHub OAuth App |
| `JWT_SECRET` | yes | Long random string used to sign JWTs; change in production |
| `JWT_EXPIRES_IN` | — | Token TTL, e.g. `7d` (default) |
| `PORT` | — | API server port (default `17642`) |
| `ALLOWED_ORIGINS` | — | CORS allowed origins, comma-separated (e.g. `http://localhost:38929`) |
| `NEXT_PUBLIC_API_URL` | yes | Full URL of the API as seen by the browser |
| `NEXTAUTH_URL` | yes | Canonical URL of the Next.js app |
| `NEXTAUTH_SECRET` | yes | NextAuth.js secret; change in production |

---

## GraphQL API

The API is available at `/api/graphql`. All queries require a `Bearer` JWT in the `Authorization` header (obtained after GitHub OAuth login).

**Fetch metrics for a date range**
```graphql
query Metrics($from: DateTime!, $to: DateTime!) {
  metrics(input: { from: $from, to: $to }) {
    date
    commits
    additions
    deletions
    prsOpened
    prsMerged
    reviewsDone
    netLines
    churnRatio
  }
}
```

**Fetch current streak**
```graphql
query Streak {
  streak {
    currentStreak
    longestStreak
    lastActiveDate
  }
}
```

**List tracked repositories**
```graphql
query Repositories {
  repositories {
    id
    fullName
    language
    isTracked
    syncState
    lastSyncedAt
  }
}
```

---

## Project Structure

```
devpulse/
├── packages/
│   ├── api/                  # NestJS 11 + Fastify backend
│   │   ├── src/
│   │   │   ├── main.ts       # Bootstrap, Swagger setup
│   │   │   ├── app.module.ts
│   │   │   └── ...           # Feature modules (auth, analytics, etc.)
│   │   ├── prisma/
│   │   │   ├── schema.prisma # Data model
│   │   │   └── migrations/
│   │   └── Dockerfile
│   └── web/                  # Next.js 15 App Router frontend
│       └── src/
│           ├── app/          # Pages (dashboard, metrics, streaks, repos)
│           └── graphql/      # Apollo Client queries
├── docs/
│   ├── ARCHITECTURE.md       # Hexagonal architecture details
│   ├── DOMAIN.md             # DDD bounded contexts & domain events
│   └── API.md                # GraphQL schema & REST endpoint reference
├── docker-compose.yml        # PostgreSQL 16 + Redis 7 + API
├── tsconfig.base.json        # Shared TypeScript config (strict)
├── eslint.config.mjs         # Shared ESLint flat config
├── .prettierrc               # Shared Prettier config
└── .env.example              # All required environment variables
```

---

## Development

```bash
# Run all tests
pnpm test

# Lint the entire monorepo
pnpm lint

# Build all packages for production
pnpm build
```

**Per-package commands**

```bash
pnpm --filter api test        # API unit tests (Vitest)
pnpm --filter web test        # Frontend tests
pnpm --filter api build       # Compile API to dist/
pnpm --filter web build       # Next.js production build
```

---

## License

MIT
