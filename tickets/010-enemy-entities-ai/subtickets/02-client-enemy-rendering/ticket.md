# Client Enemy Rendering

Render every enemy in `gameState.enemies` as a distinct 3D mesh in the Three.js scene. Use a red cone (`ConeGeometry`) to differentiate enemies from player cubes. Maintain a mesh pool keyed by enemy id so that new enemies appear, existing enemies update position each frame, and removed enemies are cleaned up.

## Acceptance Criteria
- For each enemy in `gameState.enemies`, a red cone mesh exists in the scene at the enemy's `(x, z)` position
- When a new enemy appears in `gameState.enemies` (e.g., after reconnect), its mesh is created and added to the scene
- When an enemy is removed from `gameState.enemies`, its mesh is removed from the scene and deleted from the pool
- Enemy meshes are visually distinct from player meshes (cones vs cubes, red vs blue/rosy)

## Technical Specs
- **File**: `game/client/main.js`
- Declare `const enemiesMeshes = {}` at module scope (parallel to `playersMeshes`)
- In the `animate()` loop, after the player-mesh update block, iterate `gameState.enemies`:
  - If `enemiesMeshes[id]` doesn't exist, create a `THREE.ConeGeometry(0.5, 1, 8)` with `MeshStandardMaterial({ color: 0xdc2626 })`, add to scene, store in `enemiesMeshes[id]`
  - Set mesh position to `enemy.x, 0.5, enemy.z`
- After the enemies loop, check for ids in `enemiesMeshes` that no longer exist in `gameState.enemies` — remove their mesh from scene and delete from `enemiesMeshes`

## Verification: code
