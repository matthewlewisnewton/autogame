# Normalize loaded registry models (scale + ground)

Add per-entity fit targets and post-load normalization in `attachRegistryModel` so
that when registry paths are wired in later sub-tickets, each `.glb` is scaled to
roughly match the current procedural footprint/height and its feet sit on the ground
(local y = 0 on the host mesh). Leave every `MODEL_REGISTRY` path `null` in this
sub-ticket — visuals stay procedural; only the normalization path is new.

## Acceptance Criteria

- `renderer.js` defines a per-key fit map (e.g. `MODEL_FIT`) for all seven enemy and
  minion registry keys (`grunt`, `skirmisher`, `miniboss`, `spawner`,
  `ancient_wyrm`, `null_crawler`, `bulkhead_mauler`) with `targetHeight` and/or
  `targetFootprint` derived from `ENEMY_GEOMETRY` and `MINION_VISUAL` (including
  minion `scale` where applicable).
- After a successful `loadModel` in `attachRegistryModel`, the cloned model is
  uniformly scaled to approximately match the fit target and translated so the
  bottom of its axis-aligned bounding box rests at y = 0 on the host (not centered
  through the floor).
- When the registry path is `null` or `loadModel` resolves to `null`, behavior is
  unchanged: procedural meshes stay visible, no throw, `animate()` is not blocked.
- `player` registry entry is not given fit overrides beyond remaining `null`; no
  change to `createPlayerAvatar` behavior.
- Existing server + client unit tests pass (`pnpm test` from `game/`).

## Technical Specs

- `game/client/renderer.js` only:
  - Add `MODEL_FIT` (or equivalent) keyed by registry entity key with targets taken
    from `ENEMY_GEOMETRY` (cone `height` / octahedron `radius`) and `MINION_VISUAL`
    (cylinder/box/octahedron dimensions × `scale`).
  - Add a helper (e.g. `normalizeLoadedModel(model, key)`) that:
    1. Computes `Box3.setFromObject(model)`.
    2. Uniformly scales so height (or max horizontal extent, per key shape) ≈ fit
       target.
    3. Recomputes bounds and sets `model.position.y -= box.min.y` so feet are at
       host origin.
  - Call the helper inside `attachRegistryModel` after `loadModel` succeeds, before
    `host.add(model)`.
  - Do **not** set any non-null paths in `MODEL_REGISTRY` (that happens in sub-tickets
    02–03).
- Optional: export the helper for a focused unit test, or add a small
  `game/client/test/renderer-model-fit.test.js` that feeds a mocked `Object3D` with
  known bounds and asserts scale/offset math.

## Verification: code
