# Senior Review — Spire Ascent Stage (136)

## Runtime health (gate)

`round-1/metrics.json` reports `"ok": true`, `pageerrors: []`, and a probe in
`phase: "playing"` with two connected players, a live canvas, and 5→7 enemies.
`round-1/console.log` is clean: only `[vite] connecting/connected`, two
`[initScene]` lines, one `[debugScenario] applied sloped-dungeon`, and a benign
`409 (Conflict)` resource load that occurs for **both** players during the
lobby/run-create handshake (pre-existing auth/lobby behaviour, unrelated to this
ticket — not a `pageerror` or `[fatal]`). The game starts and loads cleanly, so
the runtime gate passes.

Note: the capture fell back to the `sloped-dungeon` deterministic smoke
(`capturePlanSource: "fallback"`) rather than exercising the new
`?debugScenario=spire-ascent` shortcut, so there is no live screenshot of the
spire itself. This is a capture-plan limitation, not a code defect — the sloped
ramp render path it *did* capture (04-sloped-ramp.png) is the same generic
`floorCorners` path the spire reuses, and the spire geometry/render is covered
by passing unit + client tests (see below). Filed as a nit for future visual
coverage.

## Per-criterion findings

**New stage selectable via `generateLayout({ stage: "spire-ascent" })`** — MET.
`generateLayout(seed, 'spire-ascent')` routes to `generateSpireAscent(seed)`
(dungeon.js:141), and `'spire-ascent'` is registered in `LAYOUT_PROFILES`. The
`spire_ascent` quest (`layoutProfile: 'spire-ascent'`) is in `QUEST_DEFS` and
returned by `listQuests()`, so it reaches clients in the normal quest payload.

**3–5 distinct flat tiers, strictly increasing world Y** — MET. `tierCount =
3 + floor(rng()*3)` ∈ [3,5]; each tier is a flat room
(`yNW=yNE=ySE=ySW = DEFAULT_FLOOR_Y + i*yStep`) with `tierIndex` 0..n-1.
Tests `tier count is 3–5 across many seeds` and `each tier is flat … monotonic
tier Y` confirm this across many seeds.

**Ramp passages with slope ≥ 0.2** — MET. One ramp room per tier gap
(`tierCount-1` ramps), `rise = yStep`, `run = rampDepth = 15`. `yStep =
max(3, ceil(10/(tierCount-1)))` yields slope 0.20–0.33; the worst case
(tierCount=5 → yStep=3 → 0.20) exactly meets the bar. Test `each ramp has band
ramp, slope ≥ 0.2, and non-uniform corners` verifies it.

**Total Y gain ≥ 10** — MET. Top tier Y = `(tierCount-1)*yStep` above spawn,
which is ≥ 10 for every tierCount (3→10, 4→12, 5→12). Test `total Y gain from
start tier to top tier is ≥ 10` confirms via `sampleFloorY` across 5 seeds.

**Outer walls prevent fall-through on every tier and ramp** — MET. Tiers get
two full side walls (axis z) plus north/south walls, with only a `rampWidth`(=4)
gap where a ramp connects (via `buildHorizontalWallWithGaps`, gap centred and
width-matched to the ramp). Ramps get full side walls. Tests `every tier and
ramp has perimeter side walls` plus the AABB-reachability tests confirm the
floor stays bounded.

**Camera follows during ascent** — MET. Per-frame `updateCameraOrbit` uses
`playerY + CAMERA_HEIGHT` and `lookAt(playerX, playerY, playerZ)`
(renderer.js:399,424), so the camera rises with the player. The ticket also
fixes the *initial* spawn camera, which was hardcoded to `CAMERA_HEIGHT`
regardless of spawn floor, to `spawnFloorY + CAMERA_HEIGHT` (renderer.js:765) —
correct for a non-zero spawn floor.

**Enemy spawns distributed across tiers** — MET. `pickSpireAscentEnemySpawn`
buckets by `tierIndex` (bottom → middle → top reserved order, then round-robin),
never on ramps. `spawnEnemies` passes an incrementing `spawnIndex`
(progression.js:2756). Test `spawns enemies on bottom, middle, and top tiers but
never on ramps` (enemyCount 6) confirms all three buckets are hit and no enemy
lands on a ramp.

**Objective/exit on final tier, reachable on foot via ramps (no jumping)** —
MET. `spawnCrystals`/`spawnLoot` place objectives only on top-tier rooms; the
treasure marker renders at `topFloorY + 0.75` (client test
`places the treasure marker on the top tier`). Foot reachability is proven by
`full foot reachability from bottom spawn to all rooms` and `spawn can reach
top-tier center via walkable AABBs` (BFS over walkable AABBs minus wall
colliders, 4-direction walk steps — no vertical jump assumed), across multiple
seeds.

**Deterministic given a seed** — MET. Single `mulberry32(seed)` stream; test
`is deterministic: same seed yields deep-equal layouts` asserts `toEqual`.

**Unit tests: tier count, monotonic Y, reachability, no orphan** — MET, and
broader. `server/test/dungeon.test.js` and `spire_ascent_spawn.test.js` add the
required coverage plus slope, Y-gain, walls, roles, and spawn distribution.

## Debug scenario audit

Two scenarios added: `spire-ascent-stage` (layout-only render/collision QA) and
`spire-ascent` (full quest with tiered spawns). Both are:
- **Gated to the debug path only** — listed in `DEBUG_SCENARIOS` and handled
  solely in `applyDebugScenario`; the URL param is the only entry point.
- **Reachable normally** — `spire-ascent` reproduces the exact state of
  deploying the `spire_ascent` quest (same `applyLayoutForQuest` +
  `spawnEnemies`), and that quest is selectable via the normal quest list.
- **Invariant-preserving** — the scenario calls the same layout build,
  walkable-AABB/collider rebuild, floor sampling, and `spawnEnemies` as normal
  play; it does not skip server-side placement or validation.

## Consistency / regression

The spire reuses existing room/ramp primitives and the generic `floorCorners`
render path (no spire-specific rendering branch), consistent with the 116/117
sloped-floor foundation. Full suite for the changed files passes:
**162/162 tests** (`server/test/dungeon.test.js` 126, `spire_ascent_spawn.test.js`
6, `client/test/dungeon.test.js` 30). No regressions observed in the touched
shared helpers.

## Remaining gaps

None blocking. The acceptance criteria are fully and robustly met and the
captured run is clean. Three non-blocking nits are filed in `nits.md`
(vestigial `spawnWeight` on tiers, swapped-arg ramp call readability, and the
capture falling back to `sloped-dungeon` instead of the spire scenario).

VERDICT: PASS
