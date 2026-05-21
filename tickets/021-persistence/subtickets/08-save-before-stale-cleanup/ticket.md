# Save Before Stale-Player Cleanup

Call `savePlayerData(playerId)` before deleting stale players in `cleanupStalePlayers()`, so that a player removed for inactivity does not lose their latest state.

## Acceptance Criteria
- `cleanupStalePlayers()` calls `savePlayerData(playerId)` before `delete gameState.players[playerId]`.
- The disconnect handler (`socket.disconnect()` call inside `cleanupStalePlayers`) does not cause the player to be deleted twice or skip the save.
- A player whose socket is removed for inactivity still has their latest currency, inventory, deck, and location persisted.

## Technical Specs
- **File**: `game/server/index.js`
- In `cleanupStalePlayers()`, insert `savePlayerData(playerId)` before the `delete gameState.players[playerId]` line.
- Ensure the `socket.disconnect()` call (which triggers the disconnect handler) does not double-delete or interfere with the save. The disconnect handler already calls `savePlayerData(socket.id)` — if the stable id from sub-ticket 07 is used, verify the save uses the correct key. If the disconnect handler's save fires first, the cleanup save is a harmless no-op (player already deleted, `savePlayerData` returns early).

## Verification: code
