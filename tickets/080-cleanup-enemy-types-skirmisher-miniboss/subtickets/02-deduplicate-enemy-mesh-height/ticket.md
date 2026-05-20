# Deduplicate client ENEMY_MESH_HEIGHT from createEnemyMesh geometry

`game/client/main.js` maintains a hard-coded `ENEMY_MESH_HEIGHT` side-table (lines ~761-765) that must be kept in sync with the `ConeGeometry(...)` and `OctahedronGeometry(...)` calls inside `createEnemyMesh()` (lines ~779-797). If a future ticket tweaks mesh geometry, the health-bar y-position and mesh placement will silently drift.

Refactor so that geometry parameters (radius, height, segments) are defined in a single per-type record, and both `createEnemyMesh()` and `enemyMeshHalfHeight()` derive from it.

## Acceptance Criteria
- A single per-type geometry map (e.g., `ENEMY_GEOMETRY`) defines the geometry args for each enemy type
- `createEnemyMesh()` reads from this map instead of hard-coding `ConeGeometry` / `OctahedronGeometry` params in the switch
- `enemyMeshHalfHeight()` derives the half-height from the same map (e.g., `height / 2` for cones, `radius` for octahedron)
- No visual or behavioral change — all existing client tests pass
- The old `ENEMY_MESH_HEIGHT` constant is removed

## Technical Specs
- **File:** `game/client/main.js` — replace `ENEMY_MESH_HEIGHT` (line ~761) with a new `ENEMY_GEOMETRY` map, e.g.:
  ```js
  const ENEMY_GEOMETRY = {
    grunt:      { type: 'cone', radius: 0.5, height: 1, segments: 8 },
    skirmisher: { type: 'cone', radius: 0.3, height: 0.6, segments: 8 },
    miniboss:   { type: 'cone', radius: 0.8, height: 1.8, segments: 12 },
    spawner:    { type: 'octahedron', radius: 0.6 },
  };
  ```
  Update `enemyMeshHalfHeight(type)` to return `def.height / 2` (cone) or `def.radius` (octahedron). Update `createEnemyMesh(type)` to construct geometry from the map entry.
- **File:** `game/client/test/main.test.js` — existing tests for `createEnemyMesh()` and `enemyMeshHalfHeight()` should continue to pass without modification (they assert on geometry type / half-height values, not internals).

## Verification: code
