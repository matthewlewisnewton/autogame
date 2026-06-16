# Senior Review — Hosting: Redis lobby registry + global lobby browser + socket.io adapter

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block, servers started on :5177.
- `console.log`: no `pageerror` / `[fatal]` lines. The only `error` lines are a benign
  `409 (Conflict)` on a resource load (pre-existing auth/registration behavior, unrelated to this
  ticket's Redis backend) plus standard Vite/WebGL noise. Full-flow smoke capture reached gameplay
  (auth → lobby → ready → movement → dodge with cooldown HUD), proving the server changes do not
  regress the single-instance (REDIS_URL unset) path.

The game starts and loads cleanly. Gate passes.

## Acceptance criteria

The ticket has a single compound AC. Judged clause-by-clause:

### "With REDIS_URL set, lobbies register/deregister in Redis"
Met. `game/server/lobbyRegistry.js` writes owner on create via `hset('lobby:owners', lobbyId, instanceId)`
and removes on close via `hdel`. Wired into lifecycle in `lobbies.js`: `createLobby()` calls
`registerLobby(id)` and `removePlayerFromLobby()` calls `unregisterLobby()` when the last player leaves
(both fire-and-forget with error logging, so a Redis hiccup never blocks lobby ops). Covered by
`test/lobby_registry.test.js` (8 tests).

### "the browser reflects all instances' lobbies"
Met. `game/server/lobbyBrowser.js` publishes the local instance's summaries to `lobbies:<instanceId>`
with a 30s TTL (`publishLocalLobbies`) and `listGlobalLobbySummaries` SCANs `lobbies:*`, merges the
local set with all remote snapshots, dedupes by lobby id (local wins), drops ghost/zero-player lobbies,
and sorts deterministically. `index.js` now calls these from `broadcastLobbyList`, the INIT emit, and
`lobbyHandlers.js` (`LIST_LOBBIES`, `LOBBY_LEFT`). The aggregation, dedup, ghost-exclusion, and
TTL-expiry behaviors are directly tested in `test/global_lobby_browser.test.js` (5 tests, incl. a
two-instance union and stale-snapshot expiry).

### "socket.io uses the Redis adapter"
Met. `startServer()` attaches `createAdapter(pubClient, subClient)` when `isRedisEnabled()`, guarded by
`_redisAdapterAttached` to prevent stacking duplicate pub/sub clients across repeated `startServer()`
calls in tests; `resetSocketIoAdapter()` restores the default in-memory adapter on teardown.
`test/redis_adapter.test.js` confirms the adapter is installed when enabled, the default in-memory
adapter is kept when disabled, and the memory pub/sub shim works for the adapter.

### "with REDIS_URL unset behavior is identical to today"
Met. Every Redis entry point short-circuits on `!isRedisEnabled()`: `registerLobby`/`unregisterLobby`
become no-ops, `listGlobalLobbySummaries` returns `listLobbySummaries()` verbatim, `publishLocalLobbies`
returns undefined, and the adapter is never attached. The async `broadcastLobbyList`/INIT paths also have
synchronous-fallback `catch` blocks that emit `lobbies.listLobbySummaries()` if anything throws. The
clean smoke capture plus the full 2766-test server suite passing confirms no behavioral regression.

### "tests pass without live Redis"
Met. The suite uses `ioredis-mock` (`redis-enabled.test.js`) and an in-memory shim
(`MemoryStore`/`MemoryPubSubBus` in `redis.js`, exercised via `enableRedisForTests()`); no live Redis is
required. Verified locally: the 5 Redis-focused files (28 tests) pass, and the full `server` project
(199 files / 2766 tests) passes.

## Design / requirements consistency

This is a hosting/infra ticket; it adds a backend coordination layer and does not touch gameplay,
persistence semantics, or net-replication contracts. The REDIS_URL-unset path is byte-for-byte the prior
behavior, so `game/docs/design.md` and `requirements.md` are unaffected. No debug scenarios were added or
changed.

## Code quality

- Clean separation: `redis.js` (transport + shim) / `lobbyRegistry.js` (ownership) / `lobbyBrowser.js`
  (aggregation). Test hooks (`setRedisConstructorForTests`, `enableRedisForTests`) are clearly scoped.
- Defensive aggregation: malformed JSON snapshots and non-array payloads are skipped, not fatal.
- Teardown (`closeRedis`) disconnects real clients, clears memory state, and is invoked on shutdown
  signal and in `clearAllTimers`, avoiding leaked connections/pub-sub clients between test runs.
- Fire-and-forget Redis writes on the lobby lifecycle keep gameplay paths non-blocking.

## Remaining gaps

None blocking. Minor non-blocking nits captured in `nits.md`.

VERDICT: PASS
