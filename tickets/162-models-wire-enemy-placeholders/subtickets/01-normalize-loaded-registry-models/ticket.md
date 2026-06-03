# Normalize loaded registry models (scale + ground)

Add shared scale-and-ground-offset normalization in `renderer.js` so any
registry `.glb` swapped in via `attachRegistryModel` matches the entity's
current procedural footprint and sits with its feet at the host origin (not
centered through the floor). Registry paths stay `null` in this sub-ticket —
behavior remains procedural-only until later sub-tickets set paths.

## Acceptance Criteria

- `attachRegistryModel` calls a normalization step after `loadModel` resolves
  successfully and before `host.add(model)`.
- Normalization derives a **target footprint** from existing tables:
  - enemy keys → `ENEMY_GEOMETRY` (`height` for cones, `radius * 2` for
    octahedrons; use the larger of height vs diameter for uniform scale).
  - minion keys → `MINION_VISUAL` (cylinder/box height; include `visual.scale`
    multiplier for `ancient_wyrm`).
- The loaded model is uniformly scaled so its axis-aligned bounding box is
  approximately the target height (within ~10%).
- The model is translated so `boundingBox.min.y === 0` in the host's local space
  (feet on the ground plane, not bbox-centered).
- Keys with no geometry table entry (e.g. `player`, loot) skip normalization
  until a footprint is defined — no change to those code paths.
- With all registry paths still `null`, `createEnemyMesh` / `createMinionMesh`
  return the same procedural meshes synchronously; existing
  `createEnemyMesh()` / `enemyMeshHalfHeight()` tests in
  `game/client/test/main.test.js` still pass.
- `player` registry entry is not modified.

## Technical Specs

- `game/client/renderer.js` only:
  - Add `getRegistryTargetFootprint(key)` (or inline lookup) reading
    `ENEMY_GEOMETRY[key]` / `MINION_VISUAL[key]` and returning `{ targetHeight }`
    (and optional width hint for future use).
  - Add `normalizeLoadedRegistryModel(model, footprint)` using
    `THREE.Box3().setFromObject(model)`, uniform scale from current height to
    `targetHeight`, then `position.y -= box.min.y` after scale.
  - Invoke from `attachRegistryModel` when `model` is non-null and footprint
    exists for `key`.
  - Do **not** change `ENEMY_GEOMETRY`, `MINION_VISUAL`, procedural mesh
    construction, or `models.js` registry values.
- Optional: export `normalizeLoadedRegistryModel` for a focused unit test in
  `game/client/test/` using a simple `THREE.BoxGeometry` stub (no `.glb` fetch).

## Verification: code
