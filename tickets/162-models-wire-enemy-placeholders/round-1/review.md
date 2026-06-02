# Senior Review — 162 Models: Wire enemy + minion placeholders into the registry

## Runtime health (gate)

The captured run is clean:
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`, no `failure_kind`.
- `console.log`: only `[vite] connecting/connected`, two `409 (Conflict)` "Failed to
  load resource" lines (the lobby create/join race — benign infra noise), and
  `[initScene] Initializing Three.js scene...` for both clients. No `pageerror`,
  no `[fatal]`, no uncaught exception from game code.
- Probe shows `phase: "playing"`, `sceneInitialized: true`, 5–6 enemies live,
  HP ticking (100→94), movement working.

So the game **starts and loads cleanly** — the runtime gate passes.

## Tests

Full client suite passes: `467 passed (25 files)` via
`npx vitest run --config vitest.config.js client/test`. The new
`models-registry.test.js` (4) and `renderer-model-fit.test.js` (2) pass. The
scary `TypeError: Invalid URL: /models/miniboss.glb` stack trace printed during
`main.test.js` is the jsdom fallback path being exercised — GLTFLoader can't
fetch a root-relative URL under jsdom, the loader's `onError` resolves `null`,
and the procedural mesh stays. It is logged, caught, and the test passes; not a
regression.

## Per-criterion findings

### AC1 — Registry maps the 7 entity keys to `/models/` files — ✅
`game/client/models.js` maps `grunt`→`/models/grunt.glb`,
`skirmisher`→`/models/skirmisher.glb`, `miniboss`→`/models/miniboss.glb`,
`spawner`→`/models/spawner.glb`, `ancient_wyrm`→`/models/minion-ancient-wyrm.glb`,
`null_crawler`→`/models/minion-null-crawler.glb`,
`bulkhead_mauler`→`/models/minion-bulkhead-mauler.glb`. All 7 `.glb` files exist
under `game/client/public/models/`. Correct.

### AC2 — Each model scaled to the primitive footprint/height AND grounded — ❌ (grounding)
**Scaling** is correct: `MODEL_FIT` derives a per-key `targetHeight` from
`ENEMY_GEOMETRY`/`MINION_VISUAL`, and `normalizeLoadedModel` computes
`scaleFactor = targetHeight / currentHeight` and applies it uniformly. The
minion targets in the unit test (`ancient_wyrm` 2.25, `null_crawler` 0.7,
`bulkhead_mauler` 1.2) match `MINION_VISUAL`.

**Grounding is wrong — every loaded model floats above the floor.** This is the
blocking defect:

- Enemy meshes are placed at `world y = halfHeight` (`renderer.js:3175`,
  `position.set(enemy.x, halfHeight, enemy.z)`), because THREE.js centers
  `ConeGeometry`/`OctahedronGeometry` at the origin. The procedural cone's base
  therefore sits at world y = 0 (on the ground). Minion meshes are placed at a
  fixed `world y = 0.5` (`renderer.js:3348`).
- `normalizeLoadedModel` (`renderer.js:291`) does
  `model.position.y -= _modelFitBounds.min.y`, which grounds the model's AABB
  bottom to the **host's local** y = 0. Since the loaded model is added as a
  child of the lifted host (`host.add(model)` in `attachRegistryModel`,
  `renderer.js:358`), the model's feet land at **world y = halfHeight**, not on
  the floor.
- Net effect, per entity: grunt floats +0.5, skirmisher +0.3, miniboss +0.9,
  spawner +0.6, all minions +0.5 — i.e. each enemy/minion hovers ~50% of its
  own height above the ground.

This directly violates the AC ("sits on the ground (feet at the entity's y, not
centered through the floor)"). Note that for enemies, leaving the model
*centered* on the host (no shift) would actually have grounded it, since
`targetHeight ≈ 2·halfHeight`; the grounding shift is what lifts it off the
floor. The `renderer-model-fit.test.js` grounding assertion only checks the
model in its own local space (`box.min.y ≈ 0`) and never exercises the lifted
host, so it passes despite the float.

The gameplay screenshots (`02-after-w.png`, `03-after-d.png`) show only the
red wireframe hitbox cylinders at enemy positions with no clearly-grounded solid
enemy body inside them, which is consistent with models loading (procedural
hidden) and rendering off their expected grounded position.

### AC3 — Player NOT changed — ✅
`MODEL_REGISTRY.player` stays `null`; `attachRegistryModel('player', group)`
(`renderer.js:1321`) early-returns on the null path, so the hero stays
procedural. `player.glb` is present in the folder but intentionally unwired.

### AC4 — Missing/failed model falls back to procedural; game starts cleanly — ✅
`loadModel` resolves `null` on loader-create failure or load error (warns, never
throws, caches the failure). `attachRegistryModel` only hides procedural meshes
and adds the model on a non-null result. Covered by the two `registry model
fallback` tests (material stays visible, no `modelOverride` when `loadModel`
returns null). Game loads cleanly per the gate above.

### AC5 — Existing tests pass; capture shows the new meshes — ⚠️ partial
Tests pass. The capture proves the game runs, but does not convincingly show the
new enemy/minion meshes grounded in place — consistent with the AC2 float.

## Consistency / quality
- No design or requirements regression; change is additive and the fallback
  keeps the foundation intact.
- No new debug scenarios were added by this ticket (`debugScenario: null` in
  probes), so the debug-scenario checks are N/A.
- `createMinionMesh` and `MODEL_FIT` were exported solely for tests — harmless.

## Remaining gaps
1. **Grounding (blocking):** loaded models float ~halfHeight above the floor for
   all 7 entities because `normalizeLoadedModel` grounds to the host's local
   y=0 while the host is pre-lifted (enemies to `halfHeight`, minions to `0.5`).
   The fix must put the model's feet at world y=0. See `gaps.md`.

VERDICT: FAIL
