# Fix Movement Validation Bypasses

The server's `move` handler has two bypasses: (1) it accepts movement in lobby phase because it only rejects terminal runs, allowing a client to move/teleport before readying and enter the dungeon at an arbitrary position; (2) `firstMoveAfterSpawn` skips the speed check on connection, return-to-lobby, respawn, and debug scenario, so the first move can jump anywhere inside bounds. Additionally, the handler writes the client-provided `y` coordinate directly instead of constraining it server-side. Close these bypasses so every move is validated against speed limits from the last authoritative position.

## Acceptance Criteria
- The `move` handler only accepts movement when `gameState.gamePhase === 'playing'`. Movement emitted during `lobby` phase is rejected.
- The `firstMoveAfterSpawn` speed-check bypass is removed — every move (including the first after spawn/respawn/lobby return) is validated against `MAX_MOVE_DISTANCE_PER_TICK` from the last authoritative position.
- Player positions are reset server-side at run start (`checkAllReady`), so a player cannot carry a lobby-position into the dungeon.
- The `y` coordinate is set server-side to a fixed value (e.g., `0.5`) rather than accepted from the client.
- Legitimate movement at normal speed during `playing` phase is never rejected.

## Technical Specs
- **File**: `game/server/index.js` — In the `socket.on('move', ...)` handler, change the guard from `gameState.run && gameState.run.status !== 'playing'` to `gameState.gamePhase !== 'playing'`. Remove the `if (!player.firstMoveAfterSpawn)` wrapper around the speed check so it always runs. Set `player.y = 0.5` (or the existing fixed value) instead of `player.y = data.y`. In `checkAllReady()`, after setting `gamePhase` to `'playing'`, reset every player's position to their spawn position (e.g., `firstRoomPosition()`) and set `firstMoveAfterSpawn` to `false` (since the first move from the reset position should still be speed-checked). Do not modify any other handler, do not modify `damagePlayer`, `returnPlayersToLobby`, or `applyDebugScenario`.
- **No other files changed.** Do not modify client files, config, or tests.

## Verification: code
