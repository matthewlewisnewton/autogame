# Centralize mesh disposal helpers

`game/client/main.js` contains multiple repeated loops that iterate over a mesh map, remove from scene, dispose geometry/material, and delete the entry. The pattern appears in the second-run cleanup (~line 1256–1287) and in the removed-entity cleanup (~line 1588–1640). Loot meshes have a special case: they share geometry/material so disposal is skipped.

Extract a single helper to reduce copy-paste drift and ensure every cleanup path disposes correctly.

## Acceptance Criteria

- A helper function `disposeMeshMap(map, scene, skipDisposeMaterial?)` exists that iterates a mesh map, removes each from scene, disposes geometry and material, and clears the map.
- All existing cleanup loops for `enemiesMeshes`, `enemyHealthBars`, `telegraphMeshes`, `minionsMeshes` are replaced with calls to the helper.
- Loot mesh cleanup continues to skip geometry/material disposal (shared resources).
- The second-run cleanup path and removed-entity cleanup path still remove the right meshes.
- `npm test -- --coverage.enabled=false` passes.

## Technical Specs

- **File**: `game/client/main.js` — add `disposeMeshMap()` helper; refactor cleanup loops at lines ~1256–1287 (second-run) and ~1588–1640 (removed-entity). Keep `disposeAllLootMeshes()` as-is or call the helper with a skip-dispose flag.

## Verification: code
