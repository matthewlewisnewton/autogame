# Camera Follows Local Player

Make the camera smoothly track the local player's cube using lerped position updates and `lookAt` each frame, so the player is always centered on screen while moving around the arena.

## Acceptance Criteria
- Camera position is lerped toward `playerMesh.position + CAMERA_OFFSET` each frame using `5.0 * delta` as the lerp factor
- Camera calls `lookAt(playerMesh.position)` every frame to face the player
- `CAMERA_OFFSET` is defined as `new THREE.Vector3(0, 5, 10)` (5 units up, 10 units behind)
- The initial `camera.position.set(0, 5, 10)` in setup remains as the starting position before lerp takes over

## Technical Specs
- **File to modify**: `game/client/main.js`
- Define `const CAMERA_OFFSET = new THREE.Vector3(0, 5, 10)` near the top-level constants
- In `animate()`, after updating the local player mesh position, compute the target camera position: `playerMesh.position.clone().add(CAMERA_OFFSET)`
- Apply lerp: `camera.position.lerp(target, 5.0 * delta)`
- Call `camera.lookAt(playersMeshes[myId].position)` each frame (guard against `myId` being null)
- This depends on sub-ticket 01 so that the player mesh position being tracked is the client-predicted one

## Verification: code
