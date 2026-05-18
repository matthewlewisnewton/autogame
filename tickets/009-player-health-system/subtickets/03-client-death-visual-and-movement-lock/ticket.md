# Client: Local Death Visual & Movement Lock

When the local player enters the `dead` state, block WASD movement and make the player cube visually distinct. On respawn, restore movement and appearance automatically.

## Acceptance Criteria
- When `gameState.players[myId].dead` is `true`, WASD input no longer changes the player's position (movement is blocked)
- The local player's cube mesh is visually distinct when dead — set to a grey color (`0x808080`)
- When `dead` flips back to `false` (after respawn), movement is restored and the mesh returns to its normal blue color (`0x3b82f6`)
- The player's local `myX`/`myZ` and velocity reset to `0` on detecting the `dead → alive` transition, syncing with the server's position reset

## Technical Specs
- **File**: `game/client/main.js`
- In `updateMyPlayer(delta)`, guard: `if (me && me.dead) return` to skip position/velocity updates and prevent emitting `move`
- In the `animate()` loop, in the local-player branch (`id === myId`), check `me.dead`:
  - If dead: `playersMeshes[myId].material.color.setHex(0x808080)`
  - If alive: `playersMeshes[myId].material.color.setHex(0x3b82f6)`
- Use a `wasDead` variable to detect the `dead → alive` edge and reset `myX = 0; myZ = 0; velocityX = 0; velocityZ = 0`

## Verification: code
