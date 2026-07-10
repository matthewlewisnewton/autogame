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

Socket.IO middleware in `game/server/index.js` parses the same `ag_session` cookie from `socket.handshake.headers.cookie`, calls `getSession(sessionToken)`, and attaches `socket.data.accountId` / `socket.data.username` before the connection is accepted. The browser sends the cookie automatically on the upgrade handshake when client and server are same-origin. Destroying a session disconnects matching live sockets locally and publishes a Socket.IO server-side revocation event through the Redis adapter.

## Production

Set persistence and a shared session store:

```bash
PERSISTENCE_BACKEND=postgres
DATABASE_URL=postgres://...
REDIS_URL=redis://...
NODE_ENV=production
PORT=8080
# Optional for a separately hosted client (comma-separated allowlist):
CLIENT_ORIGIN=https://game.example.com
# Number of trusted reverse-proxy hops (defaults to 1 in production):
TRUST_PROXY_HOPS=1
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

**Policy:** Login and registration failures use Redis-backed fixed-window counters
when `REDIS_URL` is configured, so limits are shared across horizontally scaled
instances. Development without Redis falls back to the in-memory limiter.

### What is rate-limited

| Action | Route / middleware | Counting |
|--------|-------------------|----------|
| `register` | `POST /api/register` | Failed attempts |
| `login` | `POST /api/login` | Failed attempts |
| `admin` | `requireAdminPassword` in `game/server/admin.js` | Failed password attempts only |

Buckets are keyed by `action:ip:username` (username lowercased; IP from `req.ip` or socket remote address). Defaults: **10 attempts per 60 seconds** per key, overridable via `AUTH_RATE_LIMIT_MAX_ATTEMPTS` and `AUTH_RATE_LIMIT_WINDOW_MS`.

Exceeding the limit returns HTTP **429** with a generic error message.

### Implementation

- Redis deployments use hashed `auth-rate:*` keys with expiry matching
  `AUTH_RATE_LIMIT_WINDOW_MS`.
- `rateLimitBuckets` remains the no-Redis fallback and is pruned by
  `startRateLimitSweep()`.
- Successful login and registration requests do not consume the failure budget.

### Tests

Rate limiting is **disabled** when `NODE_ENV=test` unless `AUTH_RATE_LIMIT_IN_TESTS=1` is set. Tests can call `pruneExpiredBuckets()` directly and use `_resetRateLimits()` for cleanup.
