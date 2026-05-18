# Add `lastActivity` Timestamp to Player State

Initialize and maintain a `lastActivity` timestamp on every player entry in `gameState.players`. This is the foundation for detecting stale connections.

## Acceptance Criteria
- Every new player added to `gameState.players` includes `lastActivity: Date.now()`
- The existing `move` handler updates `lastActivity` on the player entry whenever it processes a movement event
- No other behavior changes — no cleanup, no new events, no client changes

## Technical Specs
- **File**: `game/server/index.js`
- In the `connection` handler, add `lastActivity: Date.now()` to the player object created in `gameState.players[socket.id] = { ... }`
- In the existing `socket.on('move', ...)` handler, add `gameState.players[socket.id].lastActivity = Date.now()` alongside the position updates

## Verification: code
