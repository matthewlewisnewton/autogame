# Derive `halfHeight` from geometry instead of hardcoding

Remove the redundant `halfHeight` field from each entry in `ENEMY_GEOMETRY` and compute it dynamically in `enemyMeshHalfHeight()` — `height / 2` for cones, `radius` for the octahedron spawner.

## Acceptance Criteria
- `enemyMeshHalfHeight()` computes half-height from `def.height / 2` for cone types and `def.radius` for octahedron types — no `halfHeight` field is read.
- The `halfHeight` field is removed from all entries in `ENEMY_GEOMETRY` (grunt, skirmisher, miniboss, spawner).
- All existing client tests pass with no visual regression.

## Technical Specs
- **File:** `game/client/main.js`
  - Remove `halfHeight` from each object in `ENEMY_GEOMETRY` (line ~763-766).
  - Rewrite `enemyMeshHalfHeight()` (line ~774) to check `def.type` and return `def.height / 2` for `'cone'` or `def.radius` for `'octahedron'`.
- **No other files changed.**

## Verification: code
