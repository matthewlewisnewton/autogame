# glTF scale and ground normalization for registry models

Add per-entity scale and vertical grounding when `attachRegistryModel` swaps in a
loaded `.glb`, so models match each type's procedural footprint/height and sit on
the floor instead of floating or sinking. No registry paths change in this
sub-ticket — every `MODEL_REGISTRY` value stays `null`, so the running game still
looks identical to today.

## Acceptance Criteria

- `attachRegistryModel` (or a small helper it calls) measures the loaded scene's
  `Box3` and applies a uniform scale so the model's height (Y extent) approximates
  the target for that registry key.
- After scaling, the model is translated so its bounding-box minimum Y aligns with
  the procedural mesh's foot plane for that entity (cone base at `-height/2`,
  octahedron at `-radius`, cylinder/box per `MINION_VISUAL` dimensions).
- Target sizes are derived from existing tables — `ENEMY_GEOMETRY` for enemy keys,
  `MINION_VISUAL` for minion keys — not hard-coded magic numbers per `.glb` file.
- `enemyMeshHalfHeight`, enemy world `position.y`, minion `position.y`, and
  procedural mesh creation are unchanged; only the attached glTF child is
  transformed.
- `player`, loot keys, and all registry paths remain `null`; no new `.glb` files
  are added.
- Existing server and client unit tests still pass.

## Technical Specs

- `game/client/renderer.js` only:
  - Add something like `getRegistryModelTarget(key)` returning `{ height, footY }`
    from `ENEMY_GEOMETRY` / `MINION_VISUAL` (export for tests if useful).
  - Add `normalizeRegistryModel(model, key)` using `THREE.Box3().setFromObject`,
    uniform scale from current height → target height, then
    `model.position.y = footY - box.min.y` (after scale, in the host's local space).
  - Call `normalizeRegistryModel` inside the `loadModel(path).then(...)` branch of
    `attachRegistryModel`, after a successful load and before `host.add(model)`.
  - Do not change `ENEMY_GEOMETRY`, `MINION_VISUAL`, `createEnemyMesh`,
    `createMinionMesh`, or `MODEL_REGISTRY` values.

## Verification: code
