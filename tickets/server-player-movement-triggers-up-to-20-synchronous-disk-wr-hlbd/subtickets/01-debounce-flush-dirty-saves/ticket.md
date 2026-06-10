# Debounce tick-triggered player saves in flushDirtyPlayerSaves()

## Description

Every MOVE packet sets `player.persistenceDirty = true`, and `flushDirtyPlayerSaves()` runs at 20 Hz in the game loop, calling `savePlayerData()` synchronously for each dirty player. Add a per-player debounce window so tick-triggered flushes write at most once every few seconds while leaving `persistenceDirty` set until the debounce elapses.

## Acceptance Criteria

- `game/server/config.js` exports `PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS` with a value between 3000 and 5000 (inclusive)
- `flushDirtyPlayerSaves()` in `game/server/simulation.js` skips a dirty player when `Date.now() - player.persistenceLastSavedAt < PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS`, leaving `persistenceDirty` true
- When a debounced flush runs, it clears `persistenceDirty`, calls `_savePlayerData(playerId)`, and sets `player.persistenceLastSavedAt` to the flush time
- A player who has never been saved (`persistenceLastSavedAt` absent or 0) is flushed on the first eligible tick
- `game/server/test/applyPlayerMovement.test.js` is updated: repeated `flushDirtyPlayerSaves()` calls within the debounce window produce at most one `_savePlayerData` call; advancing time past the window allows a second flush

## Technical Specs

- **File**: `game/server/config.js`
  - Add `const PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS = 4000;` (or another value in the 3–5 s band)
  - Export it from the module exports object alongside `PERIODIC_SAVE_INTERVAL_MS`
- **File**: `game/server/simulation.js`
  - Import `PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS` from `./config`
  - Extend `flushDirtyPlayerSaves()` (currently ~line 704): for each dirty player, compare `Date.now()` against `player.persistenceLastSavedAt || 0`; only save when the debounce window has elapsed
  - On successful save via flush, set `player.persistenceLastSavedAt = Date.now()` and `player.persistenceDirty = false`
  - Do **not** change move handlers or other `persistenceDirty` setters in this sub-ticket
- **File**: `game/server/test/applyPlayerMovement.test.js`
  - Update the existing `flushDirtyPlayerSaves()` describe block to use `vi.useFakeTimers()` where needed
  - Replace or extend the “writes at most once even if persistenceDirty stays true across the flush” test to assert debounce behavior across simulated time, not just consecutive calls in the same instant

## Verification: code
