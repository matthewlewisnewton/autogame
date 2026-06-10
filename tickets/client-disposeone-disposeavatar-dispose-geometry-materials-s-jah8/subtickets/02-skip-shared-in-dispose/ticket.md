# Skip model-cache shared resources in disposeOne and disposeAvatar

## Description

`disposeOne` and `disposeAvatar` currently traverse hosts (including `userData.modelOverride` glTF subtrees) and call `geometry.dispose()` / `material.dispose()` on every mesh. That destroys GPU buffers still referenced by the model cache and other live clones. Gate disposal with `isModelCacheShared()` from sub-ticket 01 so only per-instance resources are released.

## Acceptance Criteria

- `disposeOne(map, id, scene)` skips `.dispose()` on any geometry or material where `isModelCacheShared()` is true; procedural host geometry/material (enemy cone, hidden avatar primitive, telegraph rings, etc.) are still disposed.
- `disposeAvatar(obj)` applies the same skip rule across the full avatar group, including `userData.modelOverride` nodes; per-avatar resources created after attach (cloned player body materials from `retargetPlayerBodyMesh`, `gltfHatMesh`, `keyItemPropMesh`, procedural fallback meshes) are still disposed.
- Despawning one modeled enemy/minion via `disposeStaleMeshes` → `disposeOne` leaves a second live enemy of the same type with intact shared geometry/material references (not `.disposed` in Three.js terms).
- Rebuilding a player avatar (`disposeAvatar` on cosmetic change) or calling `updatePreview()` in the cosmetic preview (unmount → remount) does not mark shared cache geometry/material as disposed; a concurrently cached clone of the same model path remains usable.

## Technical Specs

- **`game/client/renderer.js`**
  - Import `isModelCacheShared` from `./models.js`.
  - Add a small local helper, e.g. `disposeMeshGpuResources(meshNode)`, that disposes geometry/material only when the resource exists and `!isModelCacheShared(resource)`.
  - Update `disposeOne` traverse (lines ~5783–5787) to use the helper instead of unconditional `.dispose()`.
  - Update `disposeAvatar` traverse (lines ~2415–2419) to use the same helper.
  - Do not change attach/load paths; marking is owned by sub-ticket 01.
- **`game/client/cosmetic-preview.js`** — no code changes expected; `unmountAvatar()` already calls `disposeAvatar` and should inherit the fix.

## Verification: code
