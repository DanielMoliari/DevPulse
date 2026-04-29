FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
# Install only production deps for the api package
RUN pnpm install --frozen-lockfile --filter @devpulse/api --prod

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
RUN pnpm install --frozen-lockfile --filter @devpulse/api
COPY packages/api ./packages/api
COPY tsconfig.base.json ./
WORKDIR /app/packages/api
RUN npx prisma generate
RUN npx nest build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/node_modules/.prisma ./packages/api/node_modules/.prisma
COPY packages/api/prisma ./packages/api/prisma
USER node
WORKDIR /app/packages/api
EXPOSE 3001
CMD ["node", "dist/main"]
