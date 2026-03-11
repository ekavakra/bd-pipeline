# ============================================
# BD Pipeline — Backend API Dockerfile
# Multi-stage: development | production
# ============================================

# ── Base ──────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ── Development ───────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

# Generate Prisma client
RUN pnpm --filter @bd-pipeline/db generate

EXPOSE 3001

# Push schema to DB then start dev server + BullMQ worker
CMD ["sh", "-c", "pnpm --filter @bd-pipeline/db exec prisma db push --skip-generate && (/app/node_modules/.pnpm/node_modules/.bin/tsx apps/api/src/worker.ts &) && exec pnpm --filter @bd-pipeline/api dev"]

# ── Build ─────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @bd-pipeline/db generate
RUN pnpm --filter @bd-pipeline/shared build
RUN pnpm --filter @bd-pipeline/api build

# ── Production ────────────────────────────────
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed for production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/package.json ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Non-root user
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
USER appuser

EXPOSE 3001

# Run migrations then start production server
CMD ["sh", "-c", "pnpm --filter @bd-pipeline/db migrate:deploy && node apps/api/dist/index.js"]
