# Fix registry model world-space grounding

Loaded enemy and minion `.glb` models float above the floor because
`normalizeLoadedModel` grounds each model to the host mesh's **local** y = 0, but
the host is already lifted in the render loop (enemies to `halfHeight`, minions to
`0.5`). Extend the fit/normalization path so a model's feet reach **world** y = 0
after `host.add(model)`, matching procedural primitive placement. Add a test that
exercises the lifted-host path the current unit test misses.

## Acceptance Criteria

- Each `MODEL_FIT` entry for the seven wired entity keys includes a `groundOffset`
  equal to the host's render-loop Y lift: `enemyMeshHalfHeight(key)` for enemies
  (`grunt` 0.5, `skirmisher` 0.3, `miniboss` 0.9, `spawner` 0.6) and `0.5` for all
  minion keys.
- After `normalizeLoadedModel` and attaching to a host positioned at
  `(0, groundOffset, 0)`, the model's **world-space** axis-aligned bounding box
  bottom (`box.min.y`) is approximately `0` (within `1e-4`) for at least one enemy
  key and one minion key.
- Existing scale behavior is unchanged: model height still matches `targetHeight`
  after normalization.
- No changes to `MODEL_REGISTRY` paths, player entry (`null`), or procedural
  fallback behavior.
- Existing server + client unit tests pass (`pnpm test` from `game/`).

## Technical Specs

- `game/client/renderer.js`:
  - Extend `MODEL_FIT` construction (~L255) to add `groundOffset` per key:
    - Enemies: reuse `enemyMeshHalfHeight(key)` (cone `height / 2`, octahedron
      `radius`).
    - Minions: constant `0.5` (matches minion sync at ~L3348).
  - Update `normalizeLoadedModel` (~L298): after scaling, recompute bounds and set
    `model.position.y -= (_modelFitBounds.min.y + fit.groundOffset)` so the model's
    world feet sit at y = 0 when the host is at y = `groundOffset`.
  - Update the doc comment on `normalizeLoadedModel` to describe world grounding
    via the host lift, not merely local y = 0.
  - Do **not** change enemy/minion render-loop placement or registry wiring.
- `game/client/test/renderer-model-fit.test.js`:
  - Keep the existing local-space scale/ground assertion (still valid for math).
  - Add an integration case: create a `THREE.Group` host at
    `position.y = MODEL_FIT[key].groundOffset`, run `normalizeLoadedModel`, `host.add(model)`,
    call `host.updateMatrixWorld(true)`, then assert `Box3.setFromObject(model).min.y`
    is close to `0` for `grunt` and `ancient_wyrm` (one enemy + one minion).
  - Optionally assert all seven keys in a loop with their respective host lifts.

## Verification: code
