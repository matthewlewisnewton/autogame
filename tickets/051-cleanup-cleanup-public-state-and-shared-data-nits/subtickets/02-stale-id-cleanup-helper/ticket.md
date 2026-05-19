# Replace throwaway map allocations in stale-id cleanup with a helper

The per-frame stale-mesh cleanup blocks for `enemiesMeshes`, `enemyHealthBars`, `telegraphMeshes`, and `minionsMeshes` each collect stale ids, build a temporary `{ id: mesh }` object, pass it to `disposeMeshMap`, and then delete the same ids from the real map. Each animate frame allocates and discards these temporary objects. Extract a `disposeStaleMeshes(map, currentIds, scene)` helper that iterates, disposes, and deletes in one pass — eliminating per-frame allocations and reducing each call site to a single line.

## Acceptance Criteria
- A new helper (e.g., `disposeStaleMeshes(map, currentIds, scene)`) exists near `disposeMeshMap` and handles the collect-dispose-delete loop internally.
- All four stale-mesh cleanup blocks (`enemiesMeshes`, `enemyHealthBars`, `telegraphMeshes`, `minionsMeshes`) call the helper instead of constructing intermediate object maps.
- No temporary `{ id: mesh }` objects are allocated per frame for stale cleanup.
- All existing client tests still pass.
- Enemy/minion mesh removal behavior is unchanged.

## Technical Specs
- **File**: `game/client/main.js`
  - Add `disposeStaleMeshes(map, currentIds, scene)` near line ~979 (next to `disposeMeshMap`). It should iterate `Object.keys(map)`, skip ids present in `currentIds`, call `scene.remove(mesh)`, dispose geometry/material, and `delete map[id]`.
  - Replace the 4 stale-cleanup blocks at lines ~1581-1590, ~1591-1599, ~1607-1615, ~1640-1648 with single-line calls: `disposeStaleMeshes(enemiesMeshes, currentEnemyIds, scene)`, etc.

## Verification: code
