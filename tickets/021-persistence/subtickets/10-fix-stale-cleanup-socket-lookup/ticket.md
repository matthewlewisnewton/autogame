# Fix stale cleanup socket lookup after stable player IDs

`cleanupStalePlayers()` looks up sockets by `io.sockets.sockets.get(playerId)`, but Socket.IO keys sockets by `socket.id` (a random string), not by the stable `playerId`. Fix the lookup to find the live socket via `socket.playerId` so stale-player cleanup actually disconnects the connected client before deleting the player entry.

## Acceptance Criteria
- `cleanupStalePlayers()` finds the correct Socket.IO socket for a stale player by searching for `socket.playerId === playerId`
- The found socket is disconnected before `gameState.players[playerId]` is deleted
- The fix works whether the socket is connected or already disconnected (graceful no-op when socket is gone)
- Existing behavior of saving player data before cleanup is preserved

## Technical Specs
- **File**: `game/server/index.js` — Replace `io.sockets.sockets.get(playerId)` in `cleanupStalePlayers()` with a search that iterates over `io.sockets.sockets.values()` (or uses `io.sockets.sockets.find()`) to match `socket.playerId === playerId`, then call `socket.disconnect()` on the match
- The socket lookup should be: iterate all sockets, find the one whose `.playerId` property matches the stale `playerId`

## Verification: code
