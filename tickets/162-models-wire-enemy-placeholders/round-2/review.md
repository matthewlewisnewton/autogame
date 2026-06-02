# Senior Review — 162: Wire enemy + minion placeholders into the registry

## Runtime health (gate)

- `round-2/metrics.json`: `"ok": true`, servers started (`http://localhost:5175/`),
  `"pageerrors": []`. No `harness_failure` block, no `failure_kind`.
- `round-2/console.log`: only Vite connect lines and two `[initScene]` logs — no
  `pageerror`, no `[fatal]`, and critically **no** `[models] failed to load model`
  warnings, which `loadModel` would emit on a 404 / parse failure. Clean load.
- Capture reached `phase: "playing"` with 2 players connected, 5→6 live enemies.
  Screenshots `02-after-w.png` / `03-after-d.png` show in-world enemies at the
  hostile positions.

Game starts and loads cleanly. Gate passes.

## Per-criterion findings

### AC1 — Registry maps the 7 entity keys to `/models/` files — PASS
`game/client/models.js:26-34` maps `grunt`→`/models/grunt.glb`,
`skirmisher`→`/models/skirmisher.glb`, `miniboss`→`/models/miniboss.glb`,
`spawner`→`/models/spawner.glb`, `ancient_wyrm`→`/models/minion-ancient-wyrm.glb`,
`null_crawler`→`/models/minion-null-crawler.glb`,
`bulkhead_mauler`→`/models/minion-bulkhead-mauler.glb`. All 8 `.glb` files (plus
`player.glb`) exist under `game/client/public/models/`. Covered by
`models-registry.test.js`.

### AC2 — Scaled to primitive footprint/height and grounded (feet at entity y) — PASS
`MODEL_FIT` (`renderer.js:262`) is derived from `ENEMY_GEOMETRY` and
`MINION_VISUAL`, giving each key a `targetHeight`/`targetFootprint` plus a
`groundOffset`. `normalizeLoadedModel` (`renderer.js:331`) uniformly scales the
loaded glTF to the target height, then offsets it by `-(min.y + groundOffset)`.
Because the host enemy mesh is placed at `world y = enemyMeshHalfHeight`
(`renderer.js:3193`) and minions at `world y = 0.5` (`renderer.js:3366`), and
`groundOffset` equals exactly those lifts (enemy half-height; minion 0.5), the
model's feet land at world y = 0 — on the floor.

This is the precise fix for the round-1 blocking gap (models floated +halfHeight).
`renderer-model-fit.test.js` now asserts world-space AABB bottom ≈ 0 for all seven
keys after attaching to a lifted host (lines 65-81), and `groundOffset` matches
each render-loop lift (lines 42-50). Solid verification of the regression fix.

### AC3 — Player unchanged — PASS
`MODEL_REGISTRY.player` stays `null` (`models.js:23`); `attachRegistryModel('player', …)`
early-returns on the null path (`renderer.js:374`). `player.glb` is present but
intentionally unwired. Hero remains procedural, as the customization epic owns it.

### AC4 — Failed model falls back to procedural; game still loads — PASS
`loadModel` resolves to `null` (never throws) on loader-create failure or load
error, warning once and caching the failure (`models.js:78-100`).
`attachRegistryModel` keeps the procedural mesh visible and never sets
`modelOverride` when the result is null (`renderer.js:385-386`). `models-registry.test.js`
exercises this for both `createEnemyMesh` and `createMinionMesh`. The clean capture
(ok=true, no warnings) confirms loads succeeded in practice.

### AC5 — Existing tests pass; capture shows the new meshes — PASS
Full suite green: **64 files / 1481 tests passed** (ran `vitest run` locally).
The capture exercised enemies (5→6 present, procedural primitives swapped — round-1
already confirmed the procedural meshes are hidden once a model resolves). Minions
were not summoned in this fallback smoke flow (`minions: []` in both probes), so
the minion GLBs were not *visually* exercised this run; their wiring is identical
to enemies and is covered by registry + fit + fallback unit tests. Non-blocking
(noted in nits).

## Design / regression check
Consistent with the additive model-loading plumbing from ticket 161. No server or
shared code touched; only client model wiring + render-time normalization. No debug
scenarios added or changed. No foundation regression.

## Remaining gaps
None blocking. The only observation is that the capture's deterministic smoke flow
does not summon a minion, so minion model rendering is verified by tests rather than
by a screenshot — filed as a nit.

VERDICT: PASS
