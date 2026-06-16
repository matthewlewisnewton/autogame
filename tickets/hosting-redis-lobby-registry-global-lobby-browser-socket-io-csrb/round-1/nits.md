## Deduplicate the INIT emit payload in the connection handler

In `game/server/index.js`, the socket `connection` handler builds the full
`SERVER_TO_CLIENT.INIT` payload twice — once in the async success path and once
verbatim in the `.catch()` fallback, differing only in the `lobbies` field
(global list vs. `lobbies.listLobbySummaries()`). This is error-prone: a future
field added to one copy can silently drift from the other.

### Acceptance Criteria
- The INIT payload object is constructed once (e.g. a local `buildInitPayload(lobbyList)`
  helper) and reused by both the success and fallback paths.
- Behavior is unchanged: success emits the global list, failure emits the local
  list, and existing tests still pass.

## MemoryStore.set ignores the EX option form

`MemoryStore.set(key, value)` in `game/server/redis.js` silently ignores any
trailing arguments such as `'EX', ttl`. Today this is safe only because
`publishLocalLobbies` branches on `_isMemoryShim` to call `set` then `expire`
separately. If a future caller uses the real-Redis `set(key, val, 'EX', ttl)`
form against the shim, the TTL would be silently dropped.

### Acceptance Criteria
- `MemoryStore.set` honors a trailing `EX <seconds>` / `PX <ms>` option (setting
  the expiration) instead of ignoring it, matching ioredis semantics closely
  enough for the shim.
- A unit test covers `set(key, val, 'EX', n)` applying an expiry on the memory shim.
