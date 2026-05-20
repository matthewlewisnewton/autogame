# Spawner Client Mesh

Add a distinct 3D mesh for the spawner enemy type on the client side so it is visually distinguishable from grunts, skirmishers, and minibosses.

## Acceptance Criteria

- `createEnemyMesh('spawner')` returns a distinct Three.js mesh (e.g., octahedron or scaled cone with emissive pulse).
- `ENEMY_MESH_HEIGHT` includes a `spawner` entry matching the mesh geometry's half-height.
- `enemyMeshHalfHeight('spawner')` returns the correct value.
- When a spawner enemy appears in a `stateUpdate`, the client creates and positions the correct mesh.
- Health bar rendering for spawner works (uses existing `createHealthBarMesh` with spawner type).

## Technical Specs

- **File:** `game/client/main.js` — add `spawner` case to `createEnemyMesh()` switch (e.g., `THREE.OctahedronGeometry(0.6)` with emissive material, color `0x00ccaa`); add `spawner: 0.5` to `ENEMY_MESH_HEIGHT`.
- **File:** `game/client/main.js` — export `createEnemyMesh` and `enemyMeshHalfHeight` on `window` already covers new types automatically.

## Verification: code
