# Auth Setup

The server authenticates players with an opaque **httpOnly `ag_session` cookie**. Session data is stored server-side (Redis when `REDIS_URL` is set, otherwise an in-process shim for local dev). No JWT signing secret or token verification is required.

## Local development

Start the game as usual — no auth env vars are required:

```bash
pnpm run dev   # concurrently runs server + client
```

`POST /api/register` and `POST /api/login` create a session and set the `ag_session` cookie. Protected HTTP routes (`GET /api/me`, etc.) and Socket.IO connections read that cookie on each request.

When `REDIS_URL` is unset, sessions live in the server's in-memory Redis shim (`game/server/redis.js`). That is fine for a single local process; sessions are lost on restart.

## HTTP authentication

1. **Login / register** — `game/server/auth.js` calls `createSession(accountId)` and `setSessionCookie(res, token)`.
2. **Subsequent requests** — `getSessionTokenFromRequest(req)` in `game/server/cookies.js` reads `ag_session` from the `Cookie` header; `getSession(token)` in `game/server/sessions.js` loads the session from Redis (or the in-memory shim).
3. **Logout** — `POST /api/logout` destroys the session and clears the cookie.

Cookie attributes: `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure` in production (`NODE_ENV=production`).

## WebSocket authentication

Socket.IO middleware in `game/server/index.js` parses the same `ag_session` cookie from `socket.handshake.headers.cookie`, calls `getSession(sessionToken)`, and attaches `socket.data.accountId` / `socket.data.username` before the connection is accepted. The browser sends the cookie automatically on the upgrade handshake when client and server are same-origin (or when cross-origin cookies are configured correctly).

## Production

Set persistence and a shared session store:

```bash
PERSISTENCE_BACKEND=postgres
DATABASE_URL=postgres://...
REDIS_URL=redis://...
NODE_ENV=production
PORT=8080
```

Example Fly deploy secrets:

```bash
flyctl secrets set DATABASE_URL=... REDIS_URL=...
```

See `game/Dockerfile` and `game/fly.toml` for the full operator-facing env contract.

A future `SESSION_SECRET` env var could be added to sign or encrypt cookie values; the current implementation uses opaque random tokens with server-side lookup only.

## Horizontal scaling / multi-instance

When you run more than one server process behind a load balancer, every instance must share the **same `REDIS_URL`**. Sessions are keyed in Redis (`session:<token>`); any instance can validate any session via `getSession()` — no sticky sessions are required for auth.

`POST /api/login` on instance A creates a session in Redis; the client can call `GET /api/me` or open a WebSocket on instance B as long as both instances use the same `REDIS_URL`.

User account data (registrations, profiles, settings) is persisted separately via `DATABASE_URL` / `PERSISTENCE_BACKEND`. Shared Redis synchronizes **sessions**; shared Postgres (or equivalent) synchronizes **accounts**.

## Auth rate limiting (multi-instance)

**Policy:** Auth rate limits (`isRateLimited`, `incrementRateLimit`, `startRateLimitSweep` in `game/server/auth.js`) are **in-memory per process**, not Redis-backed. This is an explicit decision for the current scale; single-instance behavior is unchanged.

### What is rate-limited

| Action | Route / middleware | Counting |
|--------|-------------------|----------|
| `register` | `POST /api/register` | Every attempt |
| `login` | `POST /api/login` | Every attempt |
| `admin` | `requireAdminPassword` in `game/server/admin.js` | Failed password attempts only |

Buckets are keyed by `action:ip:username` (username lowercased; IP from `req.ip` or socket remote address). Defaults: **10 attempts per 60 seconds** per key, overridable via `AUTH_RATE_LIMIT_MAX_ATTEMPTS` and `AUTH_RATE_LIMIT_WINDOW_MS`.

Exceeding the limit returns HTTP **429** with a generic error message.

### Implementation

- `rateLimitBuckets` — a module-level `Map` in `auth.js` holding `{ windowStart, attempts }` per key.
- `pruneExpiredBuckets()` — deletes entries whose `windowStart` is older than `RATE_LIMIT_WINDOW_MS`.
- `startRateLimitSweep()` — starts a `setInterval` every `RATE_LIMIT_SWEEP_INTERVAL_MS` (60s) to run `pruneExpiredBuckets()` locally on that process. Called once at server boot from `game/server/index.js`. Idempotent.

### Multi-instance implication

Each server process maintains **its own** counters. An attacker could spread attempts across instances (e.g. round-robin through a load balancer) and effectively multiply the allowed attempts by the instance count. **This is accepted** at current scale.

Revisit a shared store (e.g. Redis) when:

- You run many instances behind a load balancer and brute-force volume becomes a concern.
- You need a global cap independent of instance count.
- Compliance or threat modeling requires centralized rate limiting.

Until then, per-instance limits still protect each process from local abuse and keep deployment simple (no Redis dependency for auth rate limits — Redis is still required for shared sessions in multi-instance production).

### Tests

Rate limiting is **disabled** when `NODE_ENV=test` unless `AUTH_RATE_LIMIT_IN_TESTS=1` is set. Tests can call `pruneExpiredBuckets()` directly and use `_resetRateLimits()` for cleanup.
