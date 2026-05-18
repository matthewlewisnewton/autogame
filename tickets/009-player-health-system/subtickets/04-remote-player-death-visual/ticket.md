# Client: Remote Player Death Visual

Reflect each remote player's `dead` state on their 3D mesh so all clients can visually distinguish dead teammates from alive ones.

## Acceptance Criteria
- When a remote player's `pData.dead` is `true`, their cube mesh is set to a grey color (`0x808080`)
- When a remote player's `pData.dead` is `false`, their cube mesh retains its normal remote color (`0xf43f5e`)
- The color change is applied every frame in the `animate()` loop so it responds immediately to state changes from `stateUpdate`
- This applies to all remote players (`id !== myId`) already rendered in the scene

## Technical Specs
- **File**: `game/client/main.js`
- In the `animate()` loop, inside the `for (const [id, pData] of Object.entries(gameState.players))` loop, in the `id !== myId` branch (currently around lines 209-222), add after the `position.set(...)`:
  - If `pData.dead` is true: `playersMeshes[id].material.color.setHex(0x808080)`
  - If `pData.dead` is false: `playersMeshes[id].material.color.setHex(0xf43f5e)`
- This mirrors the local-player death visual logic already present in the same loop

## Verification: code
