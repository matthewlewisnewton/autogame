# Player Movement Polish

Add camera follow so the camera tracks the player's cube. Implement smooth acceleration and deceleration on WASD input instead of instant position changes.

## Acceptance Criteria
- Camera follows the player smoothly
- WASD movement has acceleration/deceleration (not instant)
- Movement still syncs correctly with the server

## Technical Specs
- **File to modify**: `game/client/main.js`
- **Delta time**: Use `THREE.Clock` and multiply movement by `delta` (seconds since last frame)
- **Velocity model**: Maintain a `velocity = { x: 0, z: 0 }` vector. On key held, add `acceleration * delta` (acceleration = `15.0`). Each frame, multiply velocity by `friction` (`0.88`).
- **Camera follow**: Set `camera.position` to `playerMesh.position + offset(0, 5, 10)` each frame using `lerp` with factor `5.0 * delta`
- **Skip server position for own player**: Do not overwrite `playersMeshes[myId].position` from server state (use local prediction only)
