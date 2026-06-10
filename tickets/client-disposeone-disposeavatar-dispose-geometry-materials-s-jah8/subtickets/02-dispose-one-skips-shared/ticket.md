# disposeOne skips shared glTF geometry/material on entity despawn

Wire `disposeOne` (and therefore `disposeStaleMeshes` / `disposeMeshMap`) to use `disposeMeshTreeSafe` so despawning one modeled enemy or minion no longer disposes GPU resources still referenced by the model cache or other live instances of that type.

## Acceptance Criteria

- `disposeOne` in `meshSync.js` uses `disposeMeshTreeSafe` instead of unconditionally calling `geometry.dispose()` / `material.dispose()` on every traversed node.
- Despawning one glTF-backed enemy (via `disposeOne` on `enemiesMeshes`) leaves geometry/material objects used by a second live enemy of the same type intact (not disposed).
- Procedural-only meshes (no `modelOverride`, owned geometry/material) are still fully disposed when removed via `disposeOne`.
- A vitest in `game/client/test/mesh-dispose.test.js` asserts shared resources survive `disposeOne` (parent ticket acceptance criterion).

## Technical Specs

- **`game/client/renderer/meshSync.js`**
  - Import `disposeMeshTreeSafe` from `../models.js`.
  - Replace the inline `mesh.traverse` dispose block in `disposeOne` with `disposeMeshTreeSafe(mesh)` when `skipDispose` is false.
  - Keep scene removal and map deletion behavior unchanged.
- **`game/client/test/mesh-dispose.test.js`** (new)
  - Mock `loadModel` / `GLTFLoader` so `createEnemyMesh('grunt')` attaches a `userData.modelOverride` with shared geometry/material (same pattern as `models-registry.test.js` fakes).
  - Create two grunt meshes, store in a map, call `disposeOne(map, idA, scene)`; assert `geometry.dispose` / `material.dispose` were not invoked on the shared resources still held by mesh B (and that mesh B remains in the map).
  - Include a procedural-only case (failed model load → no `modelOverride`) verifying owned resources are disposed.

## Verification: code
