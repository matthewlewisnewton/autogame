# Redis client foundation with in-memory fallback

Introduce a shared Redis access layer for the game server. When `REDIS_URL` is set, connect with `ioredis`; when unset (dev, tests, single-instance), use an in-process in-memory shim so behavior stays identical to today. Export stable helpers for pub/sub client pairs and a stable per-process `instanceId` used by later sub-tickets.

## Acceptance Criteria

- `game/server/package.json` adds runtime deps `ioredis` and `@socket.io/redis-adapter`, plus dev dep `ioredis-mock` (or equivalent) for tests
- `game/server/redis.js` exports `isRedisEnabled()`, `getInstanceId()`, `getRedisClient()`, `createPubSubClients()`, and `closeRedis()` (or `resetRedisForTests()`)
- With `REDIS_URL` unset, `isRedisEnabled()` is `false`, `getRedisClient()` uses the in-memory shim (no network I/O), and repeated `startServer()` / test resets do not leak state between runs
- With `REDIS_URL` set, `getRedisClient()` returns a real `ioredis` client; `createPubSubClients()` returns two distinct clients suitable for the Socket.IO adapter
- `getInstanceId()` returns `process.env.INSTANCE_ID` when set, otherwise a UUID generated once per process
- `game/server/test/redis.test.js` covers shim `hset`/`hget`/`hgetall`/`del`/`expire`, enabled/disabled detection, and instance-id stability without a live Redis server
- Existing server vitest suite still passes with `REDIS_URL` unset

## Technical Specs

- **New file:** `game/server/redis.js`
  - Read `process.env.REDIS_URL`; if missing/empty, use an in-memory `Map`-backed client implementing the subset of commands needed by follow-up tickets (`hset`, `hget`, `hgetall`, `hdel`, `set`, `get`, `del`, `expire`, `scan` or key-prefix listing)
  - `createPubSubClients()`: when enabled, return two `new Redis(REDIS_URL)` instances; when disabled, return shim pub/sub objects that fan out locally (enough for adapter wiring tests)
  - `closeRedis()` disconnects real clients and clears shim state; call from test teardown and graceful shutdown
- **New file:** `game/server/instance.js` (optional — may live in `redis.js` if tiny)
  - `getInstanceId()` as described above
- **File:** `game/server/package.json` — add dependencies
- **File:** `game/server/index.js` — import `closeRedis` and invoke from existing shutdown path (`shutdownFromSignal` / test reset) so repeated test `startServer()` calls stay clean
- **New file:** `game/server/test/redis.test.js` — unit tests for the module; use `ioredis-mock` only when asserting real-client code paths, otherwise exercise the shim directly

## Verification: code
