# Enemy glTF body mesh retarget for VFX

When `attachRegistryModel` loads a `.glb` for grunt/skirmisher/miniboss/spawner enemies, it hides the procedural cone/octahedron but leaves all emissive and color VFX writing to that hidden procedural `mesh.material`. Mirror the player fix: after the model swap, point the enemy host at the visible glTF body mesh (cloned material) and route every enemy tint/flash helper through `resolveBodyMesh`.

## Acceptance Criteria

- After a modeled enemy's glTF loads, `host.userData.bodyMesh` references the visible glTF mesh (not the hidden procedural primitive), with a per-enemy cloned material so VFX do not bleed across instances.
- `_origColor`, `_origEmissive`, and `_origEmissiveIntensity` bookkeeping on the host/body mesh reflect the loaded model material (or the type palette when the glTF has no emissive), so restore paths stay correct.
- `applyWindupFlash`, `applyRevealHighlight`, `applyEnemyVariantTint`, and `applyVariantEmissiveTint` resolve the render target via `resolveBodyMesh(enemiesMeshes[enemyId])` instead of reading `enemiesMeshes[enemyId].material` directly.
- `flashMesh(enemiesMeshes[enemyId], …)` already uses `resolveBodyMesh` and therefore hits the visible glTF body once retargeting is wired.
- Vitest in `game/client/test/models-registry.test.js` covers modeled `createEnemyMesh('grunt')` (or another registry enemy): procedural material hidden, `userData.bodyMesh` retargeted, `_orig*` fields present on the body mesh.

## Technical Specs

- **`game/client/renderer.js`**
  - Add `findEnemyBodyMesh(model)` (prefer `SkinnedMesh`, else first mesh with material — same strategy as `findPlayerBodyMesh`).
  - Add `retargetEnemyBodyMesh(host, model)` mirroring `retargetPlayerBodyMesh`: clone body material, set `host.userData.bodyMesh`, copy `_origColor` / `_origEmissive` / `_origEmissiveIntensity` from the procedural snapshot onto the cloned glTF material.
  - In `attachRegistryModel`, after `host.add(model)` for non-`player` registry keys, call `retargetEnemyBodyMesh(host, model)`.
  - Export `resolveBodyMesh` (or a thin `resolveEnemyBodyMesh(host)` wrapper) so `enemySync.js` can import it.
- **`game/client/renderer/enemySync.js`**
  - Import the body-mesh resolver and use it in `applyWindupFlash`, `applyRevealHighlight`, `applyEnemyVariantTint`, and `applyVariantEmissiveTint` (and `applyNamedRareTint` if it still reads `mesh.material` directly).
- **`game/client/test/models-registry.test.js`**
  - Add async test: mock `loadModel` for an enemy type, assert procedural `material.visible === false`, `userData.bodyMesh` is the glTF mesh, and emissive/color bookkeeping is on the body mesh.

## Verification: code
