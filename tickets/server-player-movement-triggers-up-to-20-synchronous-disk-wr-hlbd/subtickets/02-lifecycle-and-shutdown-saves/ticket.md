# Keep immediate lifecycle saves and flush all players on shutdown

## Description

Debounced tick flushes must not delay saves that players rely on when leaving or disconnecting, nor leave dirty state unwritten when the process exits cleanly. Wire direct-save paths to refresh debounce timestamps and force a full persistence flush before the HTTP server closes on SIGTERM/SIGINT.

## Acceptance Criteria

- `savePlayerData()` in `game/server/progression.js` sets `player.persistenceLastSavedAt = Date.now()` after a successful `provider.savePlayer` call (so a recent lifecycle save resets the movement debounce clock)
- Disconnect, voluntary leave, and stale-player eviction paths in `game/server/index.js` continue to call `savePlayerData()` directly (no regression to debounced-only saves)
- `installMainProcessErrorHandlers()` shutdown path (`SIGTERM` / `SIGINT`, ~line 917) calls `saveAllPlayersInAllLobbies()` (or equivalent all-lobby flush) **before** `server.close()` / `process.exit`, so any player still marked `persistenceDirty` is written on clean shutdown
- `game/server/test/persistence.test.js` or a small addition in `game/server/test/server.test.js` covers that `savePlayerData` updates `persistenceLastSavedAt`
- A test simulates shutdown flush: a player with `persistenceDirty: true` and a recent `persistenceLastSavedAt` inside the debounce window is still persisted when the shutdown save helper runs

## Technical Specs

- **File**: `game/server/progression.js`
  - In `savePlayerData(playerId)` (~line 936), after successful `provider.savePlayer`, set `player.persistenceLastSavedAt = Date.now()` on the in-memory player object
- **File**: `game/server/index.js`
  - In `shutdownFromSignal(signal)` inside `installMainProcessErrorHandlers()` (~line 917), invoke `saveAllPlayersInAllLobbies()` at the start of shutdown (before closing connections / HTTP server)
  - Reuse the existing `saveAllPlayersInAllLobbies` helper (~line 474) which iterates lobbies and calls `saveAllPlayers()` — this bypasses `flushDirtyPlayerSaves` debounce because it calls `savePlayerData` directly per player
- **Files**: `game/server/test/persistence.test.js` and/or `game/server/test/server.test.js`
  - Add focused unit test(s) for `persistenceLastSavedAt` update on direct save
  - Add a test that exercises the shutdown save path (export a test hook from `index.js` if needed, following existing patterns like other `index.js` test exports)

## Verification: code
