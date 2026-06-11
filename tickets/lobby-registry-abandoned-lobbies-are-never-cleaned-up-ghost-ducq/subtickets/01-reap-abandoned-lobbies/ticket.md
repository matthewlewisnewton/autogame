# Reap abandoned lobbies and stop advertising ghost (0-connected) lobbies

Abandoned lobbies accumulate in the Lobby Registry forever and in-run lobbies whose
players have all dropped are still shown as joinable ("In run · 0 player(s) · Drop In").
Reap lobbies that have zero connected players (within a bounded TTL, or immediately for
orphans), stop listing zero-connected lobbies, and ensure joining a reaped lobby id fails
cleanly.

## Root cause

- `cleanupStalePlayers()` (`game/server/simulation.js`) removes a stale player with a bare
  `delete _gameState.players[playerId]`, bypassing `lobbies.removePlayerFromLobby`. This
  leaves an **empty lobby orphaned** in the registry — it is never deleted and never reaped.
- `lobbySummary()` (`game/server/lobbies.js`) sets `playerCount` to the count of **all**
  player records, including `connected === false` ones still inside the disconnect grace
  window. An in-run lobby whose only players are disconnected is therefore still advertised
  in the browser with a Drop In button.

## Acceptance Criteria

- A lobby with zero connected players is removed from the registry within a bounded TTL
  (`EMPTY_LOBBY_TTL_MS`), or immediately when it has zero player records. After the TTL the
  lobby is gone from `listLobbySummaries()` and from the in-memory `lobbies` map.
- `listLobbySummaries()` never returns a lobby whose connected-player count is zero, so the
  registry can never display an entry showing `… · 0 player(s)` (waiting **or** in run), and
  an in-run lobby with zero connected players is never presented as joinable.
- A lobby orphaned by stale-player cleanup (all records removed via `cleanupStalePlayers`)
  is reaped — it does not linger in the `lobbies` map.
- Joining a reaped / unknown lobby id emits a single clean `lobbyError` (`Lobby not found`)
  and does not throw or create state.
- A lobby with at least one connected player, and a lobby whose players are only briefly
  disconnected (within the TTL), are NOT reaped — reconnection still works.
- New/updated tests in `game/server/test/` cover: empty-lobby reaping after TTL, orphan
  (zero-record) lobby reaping, zero-connected lobbies excluded from `listLobbySummaries()`,
  and a clean error joining a reaped id. Existing server + client vitest suites pass.

## Technical Specs

- `game/server/config.js`: add and export `EMPTY_LOBBY_TTL_MS` (e.g. `60000`). Keep it
  distinct from `DISCONNECT_GRACE_MS` even if the value matches.
- `game/server/lobbies.js`:
  - Add `connectedPlayerCount(lobby)` — counts `players` entries with `connected !== false`.
  - In `lobbySummary`, base `playerCount` on the connected count (not total records).
  - In `listLobbySummaries`, exclude any lobby whose connected count is zero so ghost
    lobbies are never advertised even before the reaper runs.
  - Export the new helper(s) as needed.
- `game/server/index.js`:
  - Add a `reapAbandonedLobbies()` sweep: for each lobby, if it has zero player records
    delete it immediately (orphan from stale cleanup); else if it has zero connected
    players, stamp `lobby.emptySince` (set once when it first goes empty) and once
    `now - lobby.emptySince >= EMPTY_LOBBY_TTL_MS`, evict the remaining disconnected
    records through `lobbies.removePlayerFromLobby` and delete the lobby; if a connected
    player is present, clear `lobby.emptySince`. Broadcast the lobby list when anything is
    reaped (`broadcastLobbyList()`).
  - Wire the sweep into `startServer()`'s `_intervals` on the existing
    `STALE_CLEANUP_INTERVAL_MS` cadence (alongside `evictDisconnectedPlayers`), and export
    `reapAbandonedLobbies` for tests. Clear `lobby.emptySince` when a player connects/joins.
  - Confirm `joinLobby` (`game/server/socketHandlers/lobbyHandlers.js`) already returns
    `lobbyError { reason: 'Lobby not found' }` for an unknown/reaped id; no new path needed
    beyond verifying it under test.
- `game/server/simulation.js`: optionally route `cleanupStalePlayers` removals through the
  existing remove-player callback so it does not orphan lobbies; if left as-is, the
  immediate zero-record reap above must cover it (either approach is acceptable as long as
  no orphan lobby survives).
- Tests: extend `game/server/test/lobbies.test.js` and/or `integration.test.js`. Use fake
  timers / direct calls to `reapAbandonedLobbies()` rather than real waits.

## Verification: code
