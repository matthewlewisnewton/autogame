# Mark glTF clone geometries/materials as model-cache shared

## Description

`loadModel()` returns `scene.clone(true)`, which shares `BufferGeometry` and `Material` instances with the cached source scene and every other live clone. Add a small helper in `models.js` that tags those shared GPU resources at clone time so later disposal logic can distinguish cache-owned assets from per-instance procedural meshes (avatar hats, enemy cones, cloned player body materials).

## Acceptance Criteria

- `loadModel(path)` marks every mesh `geometry` and `material` under the returned clone with a stable shared-cache flag (e.g. `userData.__modelCacheShared = true` on the resource objects themselves, not only on the root `Object3D`).
- The marker is applied on every successful clone returned to callers; failed/null loads are unchanged.
- `models.js` exports a predicate (e.g. `isModelCacheShared(resource)`) that `renderer.js` can import to gate `.dispose()` calls.
- A unit test loads a fake glTF twice via `loadModel`, asserts both clones' body mesh geometry/material carry the shared flag, and that the predicate returns true for those resources and false for a fresh procedural `THREE.Mesh`.

## Technical Specs

- **`game/client/models.js`**
  - Add `markModelCloneShared(root)` (internal) that traverses the clone and sets the shared flag on each mesh's `geometry` and `material` (handle material arrays).
  - Export `isModelCacheShared(resource)` for dispose helpers.
  - Call `markModelCloneShared` immediately after `scene.clone(true)` in `loadModel()` before resolving the promise.
- **`game/client/test/model-cache-shared.test.js`** (new) — vitest coverage for marking + predicate; mock `GLTFLoader` the same way as `models-registry.test.js`.

## Verification: code
