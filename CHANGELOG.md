# Changelog

All notable changes to DevPulse are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
