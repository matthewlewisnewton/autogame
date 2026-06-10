# Clear model-cache shared flag on per-avatar cloned body materials

## Description

`retargetPlayerBodyMesh()` clones the loaded glTF body material so per-player VFX recolor does not bleed across avatars. In real Three.js, `Material.clone()` copies `userData`, so the clone inherits `__modelCacheShared` from `loadModel()`'s cache tagging. `disposeAvatar()` then skips that per-instance material, leaking GPU resources on avatar rebuilds and cosmetic-preview updates. After cloning, clear the shared-cache marker on the avatar-owned material(s) and tighten the disposeAvatar test so it mirrors Three.js clone `userData` behavior.

## Acceptance Criteria

- After `retargetPlayerBodyMesh()` clones body material(s), each cloned material has `isModelCacheShared(material) === false` while the original cache-tagged source material on other live clones remains `true`.
- `disposeAvatar()` calls `.dispose()` on the avatar's cloned body material when the avatar is torn down; shared cache geometry on the same avatar is still not disposed.
- A separately loaded model clone of the same path remains usable after `disposeAvatar()` on an avatar that used a tinted body color (exercises the clone path in `retargetPlayerBodyMesh`).
- The `disposeAvatar` test in `model-dispose.test.js` would fail if the production fix is reverted: the fake material `clone()` copies `userData` (including `__modelCacheShared`) the way Three.js does, or the test uses real `THREE.MeshStandardMaterial` instances.
- `pnpm test:quick` from `game/` passes.

## Technical Specs

- **`game/client/models.js`**
  - Add and export a small helper, e.g. `clearModelCacheShared(resource)`, that deletes `userData.__modelCacheShared` from a geometry or material (no-op when absent). Keeps flag management centralized next to `markModelCloneShared` / `isModelCacheShared`.
- **`game/client/renderer.js`**
  - Import `clearModelCacheShared` from `./models.js`.
  - In `retargetPlayerBodyMesh()` (lines ~708–712), immediately after each `material.clone()` (single material or array map), call `clearModelCacheShared` on the cloned material(s). Do not clear the flag on shared geometry — only on per-avatar material clones.
- **`game/client/test/model-dispose.test.js`**
  - Update `makeFakeMaterial()` so `clone()` copies `userData` from the source (shallow copy is fine), matching Three.js `Material.clone()` behavior. Alternatively, switch the player glTF fixture to real `THREE.MeshStandardMaterial` for the body mesh.
  - Keep the existing `disposeAvatar` case asserting shared geometry is not disposed and cloned body material **is** disposed; with the faithful clone behavior, the test must fail without the `clearModelCacheShared` fix in `retargetPlayerBodyMesh`.

## Verification: code
