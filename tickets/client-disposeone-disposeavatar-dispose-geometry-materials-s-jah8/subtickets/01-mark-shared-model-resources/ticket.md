# Mark cached glTF clone resources and add safe mesh-tree disposal helper

`loadModel` returns `scene.clone(true)`, which shares geometry and materials with the cache and every other live clone. Add a small models-layer API that tags those shared GPU resources at clone time and provides a traversal helper that disposes only instance-owned geometry/material. Downstream `disposeOne` / `disposeAvatar` will call this helper in later sub-tickets.

## Acceptance Criteria

- After `loadModel(path)` resolves, every geometry and material on the returned clone is tagged as cache-shared (via a stable exported predicate such as `isSharedModelResource`).
- `disposeMeshTreeSafe(root)` traverses `root` and calls `geometry.dispose()` / `material.dispose()` only on resources that are **not** tagged shared; owned (procedural) resources are still disposed.
- `disposeMeshTreeSafe` handles both single materials and material arrays the same way the current dispose traversals do.
- A vitest in `game/client/test/models-dispose.test.js` loads (or mocks) two clones of the same path, disposes one clone with `disposeMeshTreeSafe`, and asserts the survivor's geometry/material instances are untouched (`dispose` was not called on them).

## Technical Specs

- **`game/client/models.js`**
  - Export `isSharedModelResource(resource)` (or equivalent) backed by a module-private symbol/flag on geometry and material objects.
  - Add `markSharedModelResources(root)` that walks the clone and tags every geometry/material.
  - Call `markSharedModelResources` on the object returned from `scene.clone(true)` inside `loadModel` (before resolving the promise).
  - Export `disposeMeshTreeSafe(root)` implementing the skip-shared traversal described above.
- **`game/client/test/models-dispose.test.js`** (new)
  - Mock or stub `GLTFLoader` with a minimal scene containing at least one mesh with geometry + material.
  - Spy on `geometry.dispose` / `material.dispose`; verify shared resources on a second clone are not disposed when the first is passed to `disposeMeshTreeSafe`.

## Verification: code
