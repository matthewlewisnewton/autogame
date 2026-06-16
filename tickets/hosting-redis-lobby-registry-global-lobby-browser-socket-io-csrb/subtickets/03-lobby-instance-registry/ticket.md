# Lobby-to-instance registry in Redis

Record which server instance owns each lobby at creation time and remove the mapping when the lobby is deleted (last player leaves / reaper evicts). When Redis is disabled, registry calls are no-ops so local-only behavior is unchanged.

## Acceptance Criteria

- `game/server/lobbyRegistry.js` exports `registerLobby(lobbyId)`, `unregisterLobby(lobbyId)`, `getLobbyOwner(lobbyId)`, and `resetLobbyRegistryForTests()`
- On `createLobby()` in `game/server/lobbies.js`, `registerLobby(id)` writes `lobbyId → instanceId` (use `getInstanceId()` from `redis.js`) to Redis hash key `lobby:owners` (or equivalent single hash)
- On lobby deletion inside `removePlayerFromLobby()` when `deleted: true`, `unregisterLobby(lobbyId)` removes the entry
- With `REDIS_URL` unset, `registerLobby` / `unregisterLobby` / `getLobbyOwner` are no-ops returning local instance id or `null` as appropriate without throwing
- With Redis enabled (shim or mock in tests), creating then deleting a lobby leaves `getLobbyOwner(lobbyId)` null; two instances registering different lobbies preserve distinct owners
- `game/server/test/lobby_registry.test.js` covers register, unregister, and no-op fallback
- Existing `lobbies.test.js` and lobby integration tests still pass

## Technical Specs

- **New file:** `game/server/lobbyRegistry.js`
  - `registerLobby(lobbyId)`: `HSET lobby:owners <lobbyId> <instanceId>`
  - `unregisterLobby(lobbyId)`: `HDEL lobby:owners <lobbyId>`
  - `getLobbyOwner(lobbyId)`: `HGET lobby:owners <lobbyId>` or `null`
  - All methods async or sync consistently; if async, callers in `lobbies.js` may fire-and-forget with `.catch(log)` to avoid blocking game loop
- **File:** `game/server/lobbies.js`
  - Import `registerLobby` / `unregisterLobby`
  - Call `registerLobby(id)` at end of `createLobby()`
  - Call `unregisterLobby(lobbyId)` in `removePlayerFromLobby()` when `remaining === 0` before `lobbies.delete`
- **File:** `game/server/redis.js` (if needed)
  - Export test helper to reset `lobby:owners` hash between tests
- **New file:** `game/server/test/lobby_registry.test.js`

## Verification: code
