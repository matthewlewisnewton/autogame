# Add Periodic Auto-Save Timer

Add a periodic background timer that saves all connected players' data every 30 seconds. This ensures that even if a server crash occurs between key events (disconnect, run end, lobby return), the most recent state is preserved on disk.

## Acceptance Criteria
- A `PERIODIC_SAVE_INTERVAL_MS` constant is added to `game/server/config.js` with a value of `30000` (30 seconds) and exported.
- `game/server/index.js` imports `PERIODIC_SAVE_INTERVAL_MS` from `./config.js`.
- A `saveAllPlayers()` function exists that iterates over all players in `gameState.players` and calls `savePlayerData(playerId)` for each.
- A `setInterval(saveAllPlayers, PERIODIC_SAVE_INTERVAL_MS)` is started inside `startServer()`, and its interval ID is tracked in `_intervals` (same pattern as the game loop and stale cleanup).
- `clearAllTimers()` clears the periodic save interval (via `_intervals` tracking).
- Errors from individual `savePlayerData()` calls inside `saveAllPlayers()` are caught and logged without affecting other players or crashing the timer.

## Technical Specs
- **Modified files**: `game/server/config.js` (add constant), `game/server/index.js` (add function + interval)
- Add `PERIODIC_SAVE_INTERVAL_MS` to `config.js` exports.
- Add `saveAllPlayers()` function near `savePlayerData()` in `index.js`.
- Start the interval in `startServer()` after the `io.on('connection')` block, alongside the existing game loop and stale cleanup intervals.
- Export `saveAllPlayers` in `module.exports` for testing.

## Verification: code
