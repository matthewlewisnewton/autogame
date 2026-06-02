## Verify material-hide does not bleed across instances when models are wired

`attachRegistryModel` (game/client/renderer.js) hides the procedural primitives on
model load via `node.material.visible = false`. This path is never exercised this
ticket (all registry paths null), but when a future ticket sets a real path, hiding
a material that happens to be *shared* between mesh instances would hide unrelated
entities too. Worth confirming each consuming mesh owns its material (enemy/minion
meshes appear to, loot clones materials) before/while wiring the first real model.

### Acceptance Criteria
- When the first `.glb` is wired into `MODEL_REGISTRY`, confirm the procedural-hide
  affects only that single entity instance, not others of the same type.
- If any consumed material is shared, switch to per-mesh `.visible` on the mesh
  object (or clone the material) rather than mutating the shared material.

## Document/clean up `host.userData.modelOverride`

`attachRegistryModel` stores the attached model on `host.userData.modelOverride`
but nothing reads it and there is no disposal path. Harmless now (never set this
ticket), but a brief comment on its intended use — or removal until needed — would
avoid dead state.

### Acceptance Criteria
- `modelOverride` is either consumed/disposed somewhere, or documented as a
  reserved hook, or removed.
