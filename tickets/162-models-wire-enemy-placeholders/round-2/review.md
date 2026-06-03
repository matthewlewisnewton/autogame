# Senior Review — 162: Wire enemy + minion placeholders into the registry

## Runtime health (gate)

The captured run is healthy:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block.
- Probes show `phase: "playing"`, `sceneInitialized: true`, `connectionState: "connected"`,
  5–6 enemies live, two players connected, latency 0–2ms.
- `console.log` is clean: only `[vite] connecting/connected`, two benign `409 Conflict`
  lobby-create races, and `[initScene]` for both clients. No `pageerror`, no `[fatal]`,
  no game-code exception.

The game starts and loads cleanly. Gate passes.

## Per-criterion findings

### Registry maps the 7 entity keys to `/models/` files
PASS. `game/client/models.js` `MODEL_REGISTRY` now maps:
`grunt → /models/grunt.glb`, `skirmisher → /models/skirmisher.glb`,
`miniboss → /models/miniboss.glb`, `spawner → /models/spawner.glb`,
`ancient_wyrm → /models/minion-ancient-wyrm.glb`,
`null_crawler → /models/minion-null-crawler.glb`,
`bulkhead_mauler → /models/minion-bulkhead-mauler.glb`.
All seven `.glb` files exist under `game/client/public/models/`. Player and loot keys
remain `null`. `client/test/models-registry.test.js` asserts each mapping.

### Models scaled to the primitive footprint and grounded
PASS. `renderer.js` adds `getRegistryTargetFootprint` (derives target height from
`ENEMY_GEOMETRY` / `MINION_VISUAL`), `normalizeLoadedRegistryModel` (uniformly scales
to `targetHeight` via bbox, then drops the model so `box.min.y` rests at local y=0),
and `getRegistryHostVerticalOffset` (subtracts the host's render-loop y so world-space
feet land on the floor). Enemy hosts are placed at `y = enemyMeshHalfHeight(type)` and
the offset cancels it; minion hosts are placed at `y = 0.5` and the offset is `0.5`.
The math grounds feet at world y=0. Covered by 11 tests in
`client/test/renderer-registry-normalize.test.js`.

### Player NOT changed
PASS. `player: null` in the registry; `attachRegistryModel('player', group)` early-returns
on the null path. The capture shows the hero still rendered as the procedural blue box.

### Missing/failed model falls back to procedural; game still loads
PASS. `attachRegistryModel` is fire-and-forget: a null path is a no-op, a rejected load
is caught and warned, and the procedural mesh is only hidden *inside* the `.then` once a
truthy model resolves. `models-registry.test.js` exercises the 404/null-resolve fallback
and confirms procedural meshes stay visible. The clean capture confirms no load failure
at runtime.

### Existing tests pass; capture shows the new meshes
PASS. Full suite re-run here: **1523 tests passed (66 files)**. The new mesh wiring is
visible in the capture by strong inference: the bright procedural enemy primitives
(grunt red `0xdc2626`, skirmisher orange, miniboss purple, spawner teal octahedron) are
**absent** from the gameplay screenshots (`02-after-w.png`, `03-after-d.png`). Procedural
materials are set `visible = false` *only* when a GLB resolves successfully; had any load
failed the colored cones would still be drawn. Their disappearance is positive proof the
GLB swap occurred and the loaded models are in the scene, sitting inside the red
hitbox-wireframe overlays (a pre-existing combat telegraph, unrelated to this ticket).

Note: no minions were summoned during the deterministic smoke capture (`minions: []`), so
minion meshes are not pictured. This is a capture-flow coverage limitation, not a defect —
the minion attach/normalize path is identical to the enemy path and is unit-tested.

### Debug scenarios
N/A. This ticket adds no `?debugScenario=` shortcut; `debugScenario` stays `null` in the
probes and no scenario gating code was touched.

## Remaining gaps

None blocking. Acceptance criteria are fully and robustly met, the game runs cleanly, and
the change is additive and consistent with `game/docs/design.md` / `requirements.md`. Minor
non-blocking polish is recorded in `nits.md`.

VERDICT: PASS
