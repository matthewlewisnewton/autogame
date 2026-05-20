# Remove Client Damage Event

The server exposes a `socket.on('damage', ...)` handler that accepts `{ targetId, amount }` from any connected client. This is an outcome message — it lets a client directly deal damage to any player. The server's `updateEnemies()` already handles all enemy→player damage on every tick. Remove this backdoor so the server is the sole source of damage application.

## Acceptance Criteria
- The `socket.on('damage', ...)` handler is removed from `game/server/index.js`.
- The `damagePlayer()` function is no longer reachable via a socket event (it may still exist as an internal function called by `updateEnemies()`).
- No other socket handlers are added or removed.
- Existing tests still pass.

## Technical Specs
- **File**: `game/server/index.js` — remove the `socket.on('damage', ...)` handler and its callback. Do not remove `damagePlayer()` itself — it is still called internally by `updateEnemies()` when an enemy's windup completes. Do not touch any other file.

## Verification: code
