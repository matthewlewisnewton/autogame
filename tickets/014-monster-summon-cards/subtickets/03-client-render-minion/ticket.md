# Client: Render Minion Meshes and Sync from Server

Minions received via `stateUpdate` are rendered in the Three.js scene as distinct meshes (green cylinders), positioned at their server-specified `x`/`z` coordinates. Minions are created/updated/removed each frame just like enemies.

## Acceptance Criteria
- A `minionsMeshes` object is declared to hold Three.js meshes keyed by minion id
- On each `animate()` frame, if `gameState.minions` exists, the code syncs minion meshes to the scene:
  - Creates a new mesh for any minion id not yet in `minionsMeshes`
  - Updates mesh position from `minion.x` and `minion.z` (y = 0.5)
  - Removes and disposes meshes for minion ids no longer present in `gameState.minions`
- Minion meshes use `CylinderGeometry(0.4, 0.4, 1, 8)` with `MeshStandardMaterial({ color: 0x22c55e })` — visually distinct from players (blue/red boxes) and enemies (red cones)

## Technical Specs
- **File**: `game/client/main.js`
- Add `const minionsMeshes = {};` near the existing `playersMeshes` and `enemiesMeshes` declarations
- In the `animate()` function, after the enemy mesh sync block, add a minion mesh sync block:
  ```javascript
  const currentMinionIds = new Set(gameState.minions ? gameState.minions.map(m => m.id) : []);
  for (const minion of (gameState.minions || [])) {
    if (!minionsMeshes[minion.id]) {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 1, 8);
      const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      minionsMeshes[minion.id] = mesh;
    }
    minionsMeshes[minion.id].position.set(minion.x, 0.5, minion.z);
  }
  for (const id of Object.keys(minionsMeshes)) {
    if (!currentMinionIds.has(id)) {
      scene.remove(minionsMeshes[id]);
      delete minionsMeshes[id];
    }
  }
  ```

## Verification: code
