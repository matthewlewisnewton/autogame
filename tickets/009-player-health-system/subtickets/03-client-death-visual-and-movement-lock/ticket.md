# Client: Death Visual & Movement Lock

When the local player enters the `dead` state, block WASD movement and make the player cube visually distinct. On respawn, restore movement and appearance automatically.

## Acceptance Criteria
- When `gameState.players[myId].dead` is `true`, WASD input no longer changes the player's position (movement is blocked)
- The local player's cube mesh is visually distinct when dead — either hidden, set to a grey color, or made transparent
- When `dead` flips back to `false` (after respawn), movement is restored and the mesh returns to its normal appearance
- The player's cube position resets to the origin when respawning (reflecting the server's position reset)

## Technical Specs
- **File**: `game/client/main.js`
- In `updateMyPlayer(delta)`, add a guard: check `gameState.players[myId].dead`; if true, skip position/velocity updates and do not emit `move`
- In the `animate()` loop, after reading `gameState.players[myId]`, check the `dead` flag:
  - If dead: set the mesh material color to grey (e.g., `0x808080`) or set `mesh.visible = false`
  - If alive: restore the original color (blue `0x3b82f6` for local player)
- Position is already driven by `myX`/`myZ` locally; after respawn the server resets position, and on the next `stateUpdate` the client should sync. Optionally reset `myX = 0; myZ = 0` when detecting `dead` transitioning from `true` to `false`

## Verification: code
