# Client-Side Prediction for Local Player

Stop the server's `stateUpdate` from overwriting the local player's mesh position. The local player's cube should be driven solely by the client's own `myX`/`myZ` values so movement feels instant and responsive.

## Acceptance Criteria
- The local player's cube position is set from local `myX` and `myZ` variables, not from `gameState.players[myId]`
- Other players' cubes are still positioned from server `stateUpdate` data
- The `animate()` loop updates `playersMeshes[myId].position` with `myX`/`myZ` every frame

## Technical Specs
- **File to modify**: `game/client/main.js`
- In the `animate()` loop, skip setting `playersMeshes[id].position` when `id === myId`
- After the `for` loop over `gameState.players`, add: `playersMeshes[myId].position.set(myX, 0.5, myZ)` (guard against `myId` being null)
- This ensures the local player's mesh reflects the client's predicted position, while all remote players still follow server authority

## Verification: code
