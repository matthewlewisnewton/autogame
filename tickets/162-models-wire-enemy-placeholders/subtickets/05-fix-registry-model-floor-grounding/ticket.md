# Fix registry model floor grounding (enemy + minion GLBs)

Registry-loaded enemy and minion `.glb` models float above the floor because
`normalizeLoadedRegistryModel()` places feet at local y=0, then
`attachRegistryModel()` parents them under hosts already raised to
`enemyMeshHalfHeight(type)` (enemies) or `y = 0.5` (minions). Compensate for
that host elevation so each model's world-space feet sit on the entity floor
while procedural meshes and fallback behavior stay unchanged.

## Acceptance Criteria

- After a registry model loads for an enemy key (`grunt`, `skirmisher`,
  `miniboss`, `spawner`), its world-space axis-aligned bounding box
  `min.y` is approximately `0` when the host mesh is at the same y used in the
  render loop (`enemyMeshHalfHeight(type)` at `enemy.x` / `enemy.z`).
- After a registry model loads for a minion key (`ancient_wyrm`,
  `null_crawler`, `bulkhead_mauler`), its world-space `min.y` is approximately
  `0` when the host is at `y = 0.5` (current minion placement).
- `normalizeLoadedRegistryModel()` still scales to `getRegistryTargetFootprint`
  and keeps local bbox `min.y === 0` before the host-offset is applied.
- Procedural meshes remain the synchronous fallback when paths are null or
  `loadModel` fails; hiding/showing behavior in `attachRegistryModel` is unchanged.
- `MODEL_REGISTRY.player` stays `null`; player avatar path is untouched.
- `pnpm test` from `game/` passes, including existing registry/normalize tests.

## Technical Specs

- `game/client/renderer.js`:
  - Add `getRegistryHostVerticalOffset(key)` (or equivalent) returning
    `enemyMeshHalfHeight(key)` for the four enemy registry keys, `0.5` for the
    three minion keys, and `0` (no extra offset) for keys without a raised host.
  - In `attachRegistryModel`, after `normalizeLoadedRegistryModel`, set
    `model.position.y -= getRegistryHostVerticalOffset(key)` before `host.add(model)`.
  - Do not change `enemyMeshHalfHeight`, `ENEMY_GEOMETRY`, `MINION_VISUAL`, or
    world `host.position` assignments in the enemy/minion sync loops unless a
    minimal bugfix is required.
- `game/client/test/renderer-registry-normalize.test.js` (or a small new test
  file): add a case that builds a host `Group`/`Mesh` at the enemy or minion
  offset y, attaches a normalized stub model with the new offset, updates the
  world matrix, and asserts world-space `Box3.min.y` is near `0`.
- Do not modify `game/client/models.js` registry paths or add/change `.glb` assets.

## Verification: code
