# Restore Persisted Location on Cold Reconnect During Active Run

Remove the `gamePhase === 'lobby'` guard that blocks location restoration when a player cold-reconnects mid-run, so saved `x/y/z/rotation` from a previous disconnect are applied regardless of the current game phase.

## Acceptance Criteria
- When a player cold-reconnects (server has no in-memory state but `provider.loadPlayer()` returns saved data) and `gameState.gamePhase` is `'playing'`, the server merges saved `x`, `y`, `z`, `rotation` into the recreated player object.
- The restored location is sent to the client in the `init` payload so the player appears at their last-known dungeon position instead of the spawn point.
- When `gameState.gamePhase` is `'lobby'`, location restoration continues to work as before (no regression).
- When no saved data exists, the player spawns at the default position regardless of game phase (no regression).

## Technical Specs
- **File**: `game/server/index.js`
- In the connection handler, the merge block currently wraps location restoration in `if (gameState.gamePhase === 'lobby')`. Remove this guard so location is restored in both `lobby` and `playing` phases.
- Specifically, around line 1515, change:
  ```js
  if (gameState.gamePhase === 'lobby') {
    player.x = savedData.x ?? player.x;
    player.y = savedData.y ?? player.y;
    player.z = savedData.z ?? player.z;
    player.rotation = savedData.rotation ?? player.rotation;
  }
  ```
  to:
  ```js
  player.x = savedData.x ?? player.x;
  player.y = savedData.y ?? player.y;
  player.z = savedData.z ?? player.z;
  player.rotation = savedData.rotation ?? player.rotation;
  ```

## Verification: code
