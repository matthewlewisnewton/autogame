# Orphan reaper must unregister lobby ownership in Redis

When `reapAbandonedLobbies()` deletes a lobby with zero player records (the orphan branch), it removes the lobby from the in-memory map directly and never calls `unregisterLobby`, leaving a permanent `lobby:owners` hash entry. Call `unregisterLobby(lobbyId)` in that branch before deleting the lobby, matching the cleanup path used by `removePlayerFromLobby`.

## Acceptance Criteria

- In `reapAbandonedLobbies()`, the zero–player-records orphan branch calls `unregisterLobby(lobbyId)` before `lobbies._lobbies.delete(lobbyId)`.
- Failures from `unregisterLobby` are logged (same fire-and-forget `.catch` pattern as `lobbies.removePlayerFromLobby`) and do not block the in-memory delete.
- With Redis enabled (memory shim or ioredis-mock): create a lobby (which registers ownership), leave it with zero player records, run `reapAbandonedLobbies()`, and assert `getLobbyOwner(lobbyId)` is `null` and the lobby is gone from `_lobbies`.
- The existing empty-lobby TTL reaper path (evict disconnected records via `removePlayerFromLobby`) still clears ownership — no regression in that scenario.
- Existing server vitest suites pass, including `reap_abandoned_lobbies.test.js` and `lobby_registry.test.js`.

## Technical Specs

- `game/server/index.js`:
  - Import/require `unregisterLobby` from `./lobbyRegistry` (alongside existing lobby-browser imports if needed).
  - In `reapAbandonedLobbies()` (~line 1616), inside the `Object.keys(lobby.state.players).length === 0` branch, invoke `unregisterLobby(lobbyId).catch((err) => console.error('[lobbyRegistry] unregisterLobby failed:', err))` before `lobbies._lobbies.delete(lobbyId)`.
  - Do **not** change the TTL branch that already routes through `removePlayerFromLobby` (that path already unregisters when the last player is removed).
- `game/server/test/reap_abandoned_lobbies.test.js` (or a focused companion test in `game/server/test/`):
  - Enable Redis for tests (`enableRedisForTests()` / `setInstanceId`), call `resetLobbyRegistryForTests()` in setup.
  - Test: `createLobby` → confirm owner registered → ensure zero player records → `reapAbandonedLobbies()` → assert lobby deleted and `getLobbyOwner` is null.
  - Use the same `require('../lobbies.js')` pattern as the existing file so state is shared with `reapAbandonedLobbies`.

## Verification: code
