# Periodic Stale Player Cleanup

Run a server-side interval that scans `gameState.players` every 5 seconds and removes any player whose `lastActivity` is older than 10 seconds. Removed players are disconnected and logged.

## Acceptance Criteria
- A `setInterval` fires every 5000 ms on the server
- On each tick, every player in `gameState.players` is checked: if `Date.now() - player.lastActivity > 10000`, the player is removed
- Removal consists of calling `socket.disconnect()` and deleting the entry from `gameState.players`
- Console log is emitted: `"Player disconnected due to inactivity: <socket.id>"`
- The interval does NOT interfere with normal `disconnect` flow (already cleaned-up sockets are skipped)

## Technical Specs
- **File**: `game/server/index.js`
- Add a `Map<socketId, Socket>` or store socket references on player entries so the cleanup interval can call `socket.disconnect()`
- Place the `setInterval` after the `io.on('connection', ...)` block (module level)
- Guard against already-disconnected sockets: check `socket.connected` before calling `disconnect()`

## Verification: code
