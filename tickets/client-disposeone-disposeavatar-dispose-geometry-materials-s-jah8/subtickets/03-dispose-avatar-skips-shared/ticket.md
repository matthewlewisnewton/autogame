# disposeAvatar skips shared glTF geometry/material on avatar teardown

Wire `disposeAvatar` to use `disposeMeshTreeSafe` so player disconnect, avatar cosmetic rebuild, hat/prop swap, and cosmetic-preview `unmountAvatar` / `updatePreview` cycles no longer dispose cache-shared glTF buffers. Instance-owned resources (procedural fallback meshes, cloned body materials from `retargetPlayerBodyMesh`, procedural hats/key-item props) must still be disposed.

## Acceptance Criteria

- `disposeAvatar` in `renderer.js` uses `disposeMeshTreeSafe` instead of unconditionally disposing every traversed mesh geometry/material.
- Disposing one player avatar with a loaded glTF `modelOverride` does not dispose geometry/material still used by the model cache or a second live avatar of the same type.
- Cloned per-avatar body materials created in `retargetPlayerBodyMesh` are still disposed (they are instance-owned, not cache-shared).
- Procedural fallback avatars (no `modelOverride`) are fully disposed as before.
- Cosmetic preview: calling `updatePreview` (unmount + remount) does not dispose shared glTF resources used by an in-scene player avatar created from the same model path.
- A vitest in `game/client/test/avatar-dispose.test.js` covers avatar dispose and cosmetic-preview `updatePreview` shared-resource survival.

## Technical Specs

- **`game/client/renderer.js`**
  - Import `disposeMeshTreeSafe` from `./models.js`.
  - Replace the body of `disposeAvatar` with a call to `disposeMeshTreeSafe(obj)` (preserve the null guard).
  - No change required to `retargetPlayerBodyMesh` material cloning unless tests show cloned materials are incorrectly tagged shared (they should not be).
- **`game/client/cosmetic-preview.js`**
  - No logic change expected if `disposeAvatar` is fixed; only add/extend tests that exercise `updatePreview` → `unmountAvatar` → `disposeAvatar`.
- **`game/client/test/avatar-dispose.test.js`** (new)
  - Mock `GLTFLoader` / `loadModel` with shared geometry/material across clones (reuse fake scene helpers from `models-registry.test.js`).
  - Create two `createPlayerAvatar` instances; `disposeAvatar` the first; assert shared geometry on the second avatar and on a fresh `loadModel` clone were not disposed.
  - Open a cosmetic preview via `openPreview`, then `updatePreview` with a new cosmetic while a main-scene avatar exists; assert shared resources on the main-scene avatar remain valid.

## Verification: code
