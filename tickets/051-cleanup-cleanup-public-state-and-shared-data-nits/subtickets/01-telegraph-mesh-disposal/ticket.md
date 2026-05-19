# Delegate telegraph mesh removal to disposeMeshMap

The per-frame telegraph removal path at `game/client/main.js:1566-1573` hand-rolls `scene.remove()`, `.geometry.dispose()`, `.material.dispose()`, and `delete` — exactly the pattern `disposeMeshMap` was extracted to consolidate. Fold this inline disposal into the helper by extending it to accept a single id (e.g., a `disposeOne(map, id, scene)` companion, or a `disposeMeshMap(map, scene, [ids])` overload).

## Acceptance Criteria
- The telegraph removal branch (`else` of the windup check) calls `disposeMeshMap` (or a thin companion) instead of hand-rolling remove/dispose/delete.
- No `scene.remove(telegraphMeshes[enemy.id])` or `telegraphMeshes[enemy.id].geometry.dispose()` appears inline in the animate loop.
- Telegraph visual behavior is unchanged (wind-up cone appears and disappears as before).
- All existing client tests still pass.

## Technical Specs
- **File**: `game/client/main.js`
  - Lines ~1566-1573: replace inline `scene.remove()` / `.geometry.dispose()` / `.material.dispose()` / `delete` with a call to `disposeMeshMap` or a new `disposeOne(telegraphMeshes, enemy.id, scene)` helper.
  - If adding `disposeOne`, place it near the existing `disposeMeshMap` at line ~979.

## Verification: code
