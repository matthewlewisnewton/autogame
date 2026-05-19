# Dead "reconnecting player" branch in connection handler

The `else` branch at line ~946 in `game/server/index.js` is intended for reconnecting players, but Socket.IO assigns a fresh `socket.id` per connection and the `disconnect` handler deletes `gameState.players[socket.id]`, making the branch unreachable. The comment ("reconnecting players keep their accumulated currency...") is misleading.

## Acceptance Criteria
- The unreachable `else` branch is removed from the connection handler.
- The misleading comment about reconnecting players keeping accumulated state is removed or corrected.
- New player initialization logic remains functionally unchanged (progress state + default deck are still set correctly).
- Existing tests continue to pass.

## Technical Specs
- **File:** `game/server/index.js` — remove the `else` block (lines ~946-949) that resets `lastActivity` and `pendingSummons` on a "reconnecting" player, and update the comment on line ~917 to remove the reconnecting-player claim.
- Verify no tests depend on the dead branch.

## Verification: code
