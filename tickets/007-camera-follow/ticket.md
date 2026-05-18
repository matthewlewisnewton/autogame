# Camera Follow Player

Make the camera smoothly follow the local player's position.

## Acceptance Criteria
- Camera tracks the local player's cube in real-time
- Camera movement is smooth (lerped), not instant snapping
- Local player's mesh is NOT overwritten by server state (client-side prediction)

## Technical Specs
- **File to modify**: `game/client/main.js`
- Define `CAMERA_OFFSET = new THREE.Vector3(0, 5, 10)`
- Each frame: `camera.position.lerp(playerMesh.position.clone().add(CAMERA_OFFSET), 5.0 * delta)`
- `camera.lookAt(playerMesh.position)`
- Skip `playersMeshes[myId].position.set(...)` from server state — use local `myX`/`myZ` only
