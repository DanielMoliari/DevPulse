# Changelog

All notable changes to reflog are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.6.0] — 2026-05-14

### Security
- JWT migrated from localStorage to httpOnly cookie — token no longer accessible to JavaScript; eliminates XSS token theft vector
- JWT no longer exposed in OAuth callback URL — API sets `Set-Cookie` header directly; frontend receives no token in query string
- Added `@fastify/cookie` plugin to API for cookie management
- `JwtStrategy` now extracts JWT from `auth_token` cookie with fallback to `Authorization: Bearer` header (playground compat)
- Logout endpoint `GET /api/v1/auth/logout` clears the cookie server-side; client calls it before redirecting
- `ENCRYPTION_KEY` env var — AES-256-GCM key for GitHub token encryption now uses a dedicated 32-byte key instead of deriving from `JWT_SECRET` with fixed salt
- GraphQL depth limit — `graphql-depth-limit` installed; max 8 levels of nesting enforced via `validationRules` in `app.module.ts`; prevents DoS via deeply nested queries
- Input validation on Team/Waitlist DTOs — `JoinWaitlistInput` now has `@IsEmail @MaxLength(254)` on email, `@MaxLength(100)` on name/company, `@MaxLength(20)` on teamSize, `@IsIn([...])` on source; `CreateTeamInput` has `@MaxLength(100)` on name
- `ENCRYPTION_KEY` added to `.env.example` with generation instructions

### Changed
- `auth/callback` page no longer reads `?token=` from URL — uses `markAuthenticated()` sessionStorage flag instead; auth state is cookie-based
- Apollo Client uses `credentials: 'include'` so the httpOnly cookie is sent on every GraphQL request
- `clearToken()` / `setToken()` / `getToken()` removed from `packages/web/src/lib/auth.ts`; replaced with `logout()`, `markAuthenticated()`, `clearAuthenticated()`
- `docs/` directory removed from git tracking (was accidentally tracked; `.gitignore` already had the rule)

## [0.5.0] — 2026-05-12

### Added
- Stripe billing — full hexagonal BillingModule: checkout session, customer portal, webhook handler at `/api/v1/stripe/webhook`
- Auto-import all repos after Stripe upgrade to PRO
- Upgrade modal — Radix Dialog with Monthly/Annual toggle (20% off yearly), 3 plans, MOST POPULAR badge; mounted globally via Zustand
- Settings → Billing tab — current plan, next billing date, Stripe portal for paid users
- Per-user auto-sync prefs — `autoSyncEnabled` + `autoSyncIntervalHours` (1h/6h/24h); cron respects each user's interval
- Team plan waitlist — `WaitlistEntry` DB table, `joinWaitlist` mutation, waitlist form UI on `/team`
- Year in Code — `/year/[year]` Wrapped-style page with 6 stat cards, streak callout, month breakdown, year nav; sidebar linked (PRO gate)
- Reviews KPI card on dashboard with sparkline and trend
- Personal records toast — trophy notification after sync when today's commits/additions/netLines beat all-time daily best
- Streak freeze — `useStreakFreeze` mutation; FREE gets 1 lifetime freeze, PRO unlimited; button on `/streaks`
- Public profile secondary stats — lines written, PRs opened, avg commits/active day on `/u/[username]`
- Public profile rank pills — Top X% by lines/PRs/commit intensity/active days; gated on `userCount ≥ 10`
- `githubUsername` column on User — persisted on every OAuth; auto-populates `username` on first login
- Delete account — `deleteAccount` mutation + two-step confirm in Settings → Danger zone
- Public profile visibility toggles — `publicShowStreak` / `publicShowRepos` in Settings
- Evolution tab on `/repos` — LanguageStream streamgraph (year-over-year language adoption)
- Global search — command-palette style, reflog profile + GitHub API fallback
- Public repo analysis — `/r/[owner]/[repo]` SSR page; reachable from landing page search bar
- Landing page repo search bar routing to `/r/[owner]/[repo]`
- Onboarding prompt — "Track your first repo" CTA when no repos tracked
- Streak milestone card — Spotify Wrapped-style, 6 milestones (7/30/60/100/200/365), localStorage-persisted dismissal
- Streak at-risk banner — amber banner after 20:00 UTC with countdown
- Notifications bell — in-session sync-complete and sync-error events
- og:image — edge runtime `opengraph-image.tsx`, 1200×627 with real stats
- Share + embed buttons on public profiles
- SEO — robots.ts, sitemap.ts, rich metadata

### Changed
- Plan limits restructured: FREE = 10 repos + 90-day history; PRO = unlimited repos + all-time history + Year in Code + rank pills; TEAM = same as PRO (waitlist)
- Sync cron changed from fixed 6-hour global to per-user interval (1h/6h/24h) with enabled toggle
- Public profile opt-in now correctly enforced in `PublicProfileService` (was always-public bug)
- `isPrivate` on repo detail now reads from DB field, not star/fork heuristic
- `importFromGitHub` returns `{ imported, tracked }` object (was returning `boolean`)
- Streak milestone comparison uses `≤` (was exact `===`, missing users between milestones)
- Settings name state initialization moved to `useEffect` (was mutating state in render body)

### Fixed
- ESLint errors blocking production build
- Stripe SDK v22 `currentPeriodEnd` read from subscription item (not subscription root)
- Streak row ensured to exist before recalculate on first sync
- `upsertRepository` now updates `isTracked` on re-import
- Non-null assertion for `noUncheckedIndexedAccess` in `importFromGitHub`

## [0.1.0] — 2026-04-29

### Added
- Monorepo structure with pnpm workspaces (`packages/web`, `packages/api`)
- NestJS 11 + Fastify backend with hexagonal (ports & adapters) architecture
- GraphQL API for analytics queries — metrics, streak, heatmap, repositories, me
- GitHub OAuth 2.0 + JWT authentication (passport-github2, @nestjs/jwt)
- Prisma 7 schema with driver adapter — User, Repository, DailyMetrics, Streak, WeeklyDigest, Webhook
- Next.js 15 App Router frontend with React 19 and Apollo Client v4
- Dashboard overview with contribution heatmap and metric KPI cards
- Metrics page — daily commits, PR throughput, code volume, churn ratio, language distribution, hourly activity
- Streaks page — current/longest streak display, full-year contribution calendar
- Repositories page — track/untrack repos, on-demand sync
- Settings page — profile, connected accounts, notification preferences
- Multi-stage Dockerfile for production API (non-root, port 17642)
- Docker Compose for local development (PostgreSQL 16, Redis 7, API)
- Demo seed script — 180 days of realistic developer metrics with active 23-day streak
- Vitest unit tests for streak calculator and analytics domain
- Linear-inspired dark UI design system (Tailwind v4, teal accent `#06b6d4`)
- Spotify Wrapped-style achievement cards for streak milestones
