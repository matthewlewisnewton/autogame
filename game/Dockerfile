# syntax=docker/dockerfile:1
#
# Multi-stage image for the autogame server (express + socket.io) which also
# serves the built Vite client same-origin in production. Instances are
# STATELESS: player data lives in Postgres (DATABASE_URL) and cross-instance
# coordination in Redis (REDIS_URL), so no Fly volume is required.
#
# Required runtime env (set via `flyctl secrets set` / fly.toml [env]):
#   NODE_ENV=production  PORT=8080
#   JWT_SECRET=<strong shared secret, identical on every instance>
#   PERSISTENCE_BACKEND=postgres  DATABASE_URL=postgres://...
#   REDIS_URL=redis://...         (FLY_MACHINE_ID is injected by Fly)

# ---- builder: install workspace deps (native bcrypt/deasync) + build client ----
FROM node:22-bookworm AS builder
RUN npm install -g pnpm@11.1.3
WORKDIR /app

# Manifests first for better layer caching on dependency changes.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN pnpm install --frozen-lockfile

# Source, then build the client to client/dist (served by the server in prod).
COPY . .
RUN pnpm -C client run build

# ---- runtime: slim image carrying prod deps + built client ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
# Carry the whole built workspace (node_modules incl. natives built above,
# plus client/dist which the server resolves at ../client/dist).
COPY --from=builder /app ./
WORKDIR /app/server
EXPOSE 8080
# /healthz returns 503 until routes+handlers are mounted, 200 when ready.
CMD ["node", "index.js"]
