# Remove Client Damage Event and Fix Integration Tests

The server exposes a `socket.on('damage', ...)` handler that accepts `{ targetId, amount }` from any connected client. This is an outcome message — it lets a client directly deal damage to any player. Remove this backdoor and update the two integration tests that depend on it to use the server-authoritative `damagePlayer()` export instead.

## Acceptance Criteria
- The `socket.on('damage', ...)` handler is removed from `game/server/index.js`.
- The `damagePlayer()` function remains as an internal function (called by `updateEnemies()` and exported for tests).
- The two integration tests in `game/server/test/integration.test.js` (lines ~868 and ~1108) that previously used `socket.emit('damage', ...)` are updated to call `damagePlayer(playerId, amount)` directly via the module export.
- All existing server tests still pass.

## Technical Specs
- **File**: `game/server/index.js` — remove the `socket.on('damage', ...)` handler and its callback (around line 1193). Do not remove `damagePlayer()` itself — it is still called internally by `updateEnemies()` when an enemy's windup completes. Do not remove `checkRunTerminalState` from the conditional exports block.
- **File**: `game/server/test/integration.test.js` — replace the two `socket2.emit('damage', { targetId: socket2.id, amount: 100 })` calls with `damagePlayer(socket2.id, 100)` using the import from `../index.js`. Both tests are in the "runFailed" flow and need this alternative to kill the second player.
- Do not touch any other file.

## Verification: code
