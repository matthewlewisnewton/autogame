# Redis-backed session module (`sessions.js`)

Add `game/server/sessions.js` with opaque server-side sessions stored in Redis (or the in-memory shim when `REDIS_URL` is unset). Sessions use random tokens and a sliding TTL; no JWT signing secret is required.

## Acceptance Criteria

- `createSession(accountId)` generates a 32-byte base64url token, stores `session:<token>` as a Redis hash `{ accountId, createdAt, lastSeen }`, sets an initial TTL (default 24h), and returns the token.
- `getSession(token)` returns the session object for a valid token, returns `null` for missing/unknown tokens, and refreshes `lastSeen` plus extends the TTL (sliding window).
- `destroySession(token)` deletes the Redis key and returns whether a session was removed.
- `refreshSession(token)` updates `lastSeen` and extends TTL without requiring a full read path (or is folded into `getSession` if that is the only refresh entry point — document the chosen API in exports).
- Unit tests pass with the in-memory Redis shim (`REDIS_URL` unset).
- Unit tests with `ioredis-mock` prove a session written via one `getRedisClient()` lifecycle is readable after `closeRedis()` + re-init (simulated second instance).

## Technical Specs

- **`game/server/sessions.js`** (new)
  - Import `getRedisClient`, `closeRedis`, `setRedisConstructorForTests`, `clearRedisConstructorForTests` from `./redis.js`.
  - Token generation: `crypto.randomBytes(32).toString('base64url')`.
  - Redis key prefix: `session:<token>`; store `accountId`, `createdAt`, `lastSeen` as hash fields (ISO strings or epoch ms — pick one and use consistently).
  - Default TTL: `86400` seconds (match current JWT 24h expiration).
  - Export `createSession`, `getSession`, `destroySession`, and any refresh helper; export `SESSION_TTL_SECONDS` and `SESSION_KEY_PREFIX` for tests.
  - Do **not** remove or change JWT code in `auth.js` in this sub-ticket.
- **`game/server/test/sessions.test.js`** (new)
  - Cover create/get/destroy lifecycle, TTL extension on get, and unknown-token `null`.
  - `beforeEach`/`afterEach`: `closeRedis()`, restore env.
  - Cross-instance case: `setRedisConstructorForTests(RedisMock)`, `process.env.REDIS_URL = 'redis://mock'`, create session, `closeRedis()`, new `getRedisClient()`, assert `getSession(token)` still resolves.

## Verification: code
