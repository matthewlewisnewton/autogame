# Socket.IO Redis adapter for cross-instance broadcasts

Wire `@socket.io/redis-adapter` into server startup so Socket.IO room broadcasts (`io.to(lobbyId).emit`, `io.emit`) fan out across Node processes when Redis is enabled. When `REDIS_URL` is unset, skip adapter installation and keep today's default in-memory adapter.

## Acceptance Criteria

- In `startServer()`, before registering connection handlers, when `isRedisEnabled()` is true, call `io.adapter(createAdapter(pubClient, subClient))` using `createPubSubClients()` from `game/server/redis.js`
- When `REDIS_URL` is unset, `io.adapter()` is not called with the Redis adapter (existing single-process broadcast behavior unchanged)
- Pub/sub clients are closed via `closeRedis()` on shutdown and test reset without leaving open handles
- `game/server/test/redis_adapter.test.js` asserts: with a test hook forcing Redis enabled + shim pub/sub, `io.of('/').adapter` is a Redis adapter instance; with Redis disabled, adapter remains the default in-memory type
- Existing lobby integration tests (`server/test/integration.test.js` lobby cases, `lobbies.test.js`, `dual_socket_race.test.js`) pass without `REDIS_URL` set

## Technical Specs

- **File:** `game/server/index.js`
  - Import `createAdapter` from `@socket.io/redis-adapter`, plus `isRedisEnabled`, `createPubSubClients`, `closeRedis` from `./redis.js`
  - In `startServer()`, after `io.removeAllListeners('connection')` and before JWT middleware registration, conditionally attach the Redis adapter (guard with a module flag like `_redisAdapterAttached` so repeated `startServer()` in tests does not stack adapters)
  - Store pub/sub client refs for cleanup in `closeRedis()` / shutdown
- **File:** `game/server/redis.js` (if needed)
  - Ensure shim pub/sub supports `publish`/`subscribe`/`psubscribe`/`duplicate` minimally so adapter init does not throw in tests
- **New file:** `game/server/test/redis_adapter.test.js`
  - Boot `startServer()` on ephemeral port with Redis shim enabled via test env or exported `enableRedisForTests()` helper from `redis.js`
  - Inspect adapter constructor name or `adapter.pubClient` presence

## Verification: code
