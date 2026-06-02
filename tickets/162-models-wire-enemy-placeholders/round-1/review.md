# Senior Review — 162: Wire enemy + minion placeholders into the registry

## Runtime health (gate)

The captured run is clean and the game starts and loads:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`,
  `failure_kind` absent. Probes show `phase: "playing"`, `sceneInitialized: true`,
  `connectionState: "connected"`, with 5–6 enemies live in the scene.
- `console.log`: only `[vite] connecting/connected` and `[initScene]` — **no**
  `pageerror`, `[fatal]`, or `[models] failed to load` warnings.
- `client.log`/`server.log`: clean. Only benign `THREE.Clock` deprecation
  warnings. Server logged player connect/disconnect and dungeon layout normally.

Critically, the absence of any `[models] failed to load "..."` warning means all
seven placeholder `.glb` files resolved successfully — a failed load would have
logged via `loadModel`'s error handler (models.js:97) and left the procedural
mesh visible. The capture (02/03) shows enemies rendering with their procedural
cone primitives swapped out (no solid colored cones visible, only the always-on
red hitbox wireframes), which is the expected post-swap state.

## Per-criterion findings

### 1. Registry maps the 7 entity keys → `/models/` files — PASS
`game/client/models.js` MODEL_REGISTRY now sets, exactly as specified:
`grunt→/models/grunt.glb`, `skirmisher→…/skirmisher.glb`,
`miniboss→…/miniboss.glb`, `spawner→…/spawner.glb`,
`ancient_wyrm→…/minion-ancient-wyrm.glb`,
`null_crawler→…/minion-null-crawler.glb`,
`bulkhead_mauler→…/minion-bulkhead-mauler.glb`. All seven files exist under
`game/client/public/models/` (verified on disk, CC0 per `CREDITS.md`). No models
were authored/added in this ticket (only registry + renderer edits).

### 2. Scale-to-primitive + grounded — PASS
`renderer.js` adds `normalizeRegistryModel(key, model)` (line 356), invoked from
`attachRegistryModel`'s success branch before the swap (line 285). Logic is
sound:
- Enemy keys use `enemyMeshHalfHeight` (cone height/2 or octahedron radius);
  minion keys use the new `minionMeshHalfHeight` (cylinder/box height/2,
  octahedron radius). Target height = `halfHeight * 2`.
- Computes the model bbox via `Box3.setFromObject` (pre-scale, identity
  transform on the fresh clone), guards a degenerate/non-finite `size.y`, then
  scales uniformly to the target height.
- Grounds by setting `position.y = -halfHeight - box.min.y*scale`, which lands
  the model's scaled bbox min at local `-halfHeight` — the same local base the
  centered procedural geometry occupies. Enemies are positioned at world
  `y = halfHeight` (renderer.js:3297) so feet land on the floor; minions inherit
  the host's `MINION_VISUAL.scale` equally (model is a child), so the model
  matches the primitive's rendered extent. Math verified.
- `ENEMY_MODEL_TUNING` / `MINION_MODEL_TUNING` provide neutral (1, 0) per-entity
  overrides for later fine-tuning without code changes.

### 3. Player NOT changed — PASS
`MODEL_REGISTRY.player` stays `null`; `attachRegistryModel('player', …)` takes
the null-path early return (renderer.js:274) and the hero remains procedural.
`player.glb` exists on disk but is intentionally unwired (customization epic).

### 4. Failed model falls back to procedural; clean start — PASS
`loadModel` resolves `null` (never throws) on missing/broken/unparseable paths
and caches the failure; `attachRegistryModel` keeps the procedural mesh when the
result is null. `normalizeRegistryModel` no-ops on degenerate boxes and on
non-enemy/minion keys. Fire-and-forget design never blocks the render loop. The
captured run confirms a clean load.

### 5. Existing tests pass; capture shows new meshes — PASS
Ran the full client+server vitest suite: **63 files / 1482 tests passed, 0
failed** (the wrapper's exit-1 was the pipeline/timeout, not a test failure).
Capture shows live enemies rendering with procedural cones swapped out and no
load errors. (Minions were not summoned during the deterministic smoke capture —
`minions: []` — so minion meshes were not visually exercised, but they share the
identical, tested `attachRegistryModel`/`normalizeRegistryModel` code path.)

## Consistency / regression
- No `game/docs/design.md` or `requirements.md` constraints are violated; the
  diff is limited to `models.js` + `renderer.js` (plus sub-ticket docs).
- No debug scenario was added or changed (`debugScenario` is the pre-existing
  null path).

## Remaining gaps
None blocking. The placeholder models render somewhat dark/subtle under current
lighting and minion meshes weren't visually captured — both noted in `nits.md`
as non-blocking follow-ups.

VERDICT: PASS
