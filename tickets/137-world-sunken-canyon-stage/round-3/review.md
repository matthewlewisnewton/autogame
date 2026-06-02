# Senior review: 137 — Sunken Canyon Stage (round 3)

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| Servers started | Pass (`http://localhost:5175/`) |
| `pageerrors` | Empty |
| `failure_kind` | Absent |
| `console.log` | No `pageerror` or `[fatal]` lines; only Vite connect, benign 409 on register, scene init, and `[debugScenario] applied sloped-dungeon` |

The captured run proves the game loads and plays. The 409 Conflict lines are auth/register noise, not game defects.

**Capture caveat:** Round-3 used the harness **sloped-dungeon** fallback on the default `training_caverns` quest (`capturePlanSource: "fallback"`). Screenshots show a generic sloped room, not the sunken-canyon layout. That does not invalidate runtime health, but it does not visually exercise this ticket’s signature stage (noted under nits).

## Per-criterion findings

### `generateLayout({ stage: "sunken-canyon" })`

Implemented in `game/server/dungeon.js`: object form resolves seed via `questLayoutSeed('sunken-canyon')` when omitted and delegates to `generateSunkenCanyon`. Legacy `generateLayout(seed, 'sunken-canyon')` remains. Tests in `dungeon.test.js` (`describe('generateLayout({ stage: "sunken-canyon" })')`) verify profile, `stageMeta`, seed parity, and determinism.

### Two elevation bands (plateau + canyon)

`generateSunkenCanyon` builds one `band: 'plateau'` room (14×14) and one `band: 'canyon'` room (32×32, area 1024 ≥ `MIN_CANYON_AREA` ≈ 729). Tests assert exactly one plateau and one canyon room per layout. Ramp connectors use `band: 'ramp'` but are sloped transition geometry, not a third flat band — consistent with the ticket intent.

### 2–3 ramp paths, `floorCorners`, slope ≥ 0.15

`numRamps = 2 + floor(rng()*2)` (2 or 3). Ramps use `createDescendingRampRoom` with north-high / south-low `floorCorners` on the shared helper (aligned with spire direction notes). `averageRampSlope` is exported and tested ≥ 0.15 on all ramps. Y drop uses `yPlateau: 10`, `yCanyon: 1` (ΔY = 9 ≥ 8); tests compare `sampleFloorY` at plateau vs canyon center.

### Reachable on foot, no cliff drop

Room-graph BFS from plateau index reaches canyon index on multiple seeds. `computeWalkableAABBs` includes all rooms (plateau, ramps, canyon) and passage corridors. Ramp depth spans plateau south edge to canyon north edge (`rampMinDepth` 20, actual span ~55). No separate continuous-path integration test, but geometry and AABB coverage are coherent.

### Outer walls, no walk-off gaps

`buildRoomEdgeWalls` encloses plateau (north/west/east full, south with ramp-aligned gaps + parapet) and canyon (north gaps at ramps, other edges closed). `outerPerimeterClosed` tested across seeds.

### Camera follow and plateau vista

- **Follow:** `computeCameraOrbitTarget` uses `playerY + CAMERA_HEIGHT` (not `DEFAULT_FLOOR_Y`). `renderer-camera.test.js` asserts elevated targets on plateau and mid-ramp for sunken-canyon layouts.
- **Vista:** South plateau edge uses `parapet: true` walls at `PARAPET_WALL_HEIGHT` (1.2). Client `resolveWallHeight` / `buildDungeon` honor parapet tags; `client/test/dungeon.test.js` asserts parapet mesh height < standard `WALL_HEIGHT`.

Round-3 capture did not screenshot `sunken-canyon-stage`, but code + unit tests satisfy the structural vista requirement (low south parapet). Sub-ticket 04 was scoped for this behavior.

### Enemy spawn distribution

`pickSunkenCanyonEnemyBand` in `progression.js` forces ≥1 plateau spawn and canyon majority; zero ramp spawns. `sunken_canyon_spawn.test.js` validates band counts and determinism.

### Objective / exit on canyon floor

Quest `sunken_canyon` uses `layoutProfile: 'sunken-canyon'`, `defeat_enemies`. Canyon room gets `role: 'treasure'` after layout-specific overrides. Crystal objectives and treasure-role samples are inside canyon AABB (spawn tests). Plateau→canyon BFS distance is finite from default spawn.

### Deterministic given a seed

Identical layouts for repeated seeds; ramp count 2 and 3 both appear across seed sweep.

### Unit tests (bands, ramps, Y drop, slope, reachability)

Coverage in `server/test/dungeon.test.js` (layout geometry, cover scatter, colliders) and `server/test/sunken_canyon_spawn.test.js` (spawn/objectives). Full `pnpm test:quick`: **1423 tests passed** (round-3 `coverage.log`: 1099 tests in changed-file coverage run, all passed).

## Design alignment

- Matches `game/docs/design.md` floor geometry (`floorCorners`, `sampleFloorY`, ramps).
- No regression against `game/docs/requirements.md` foundation (multiplayer, movement, 3D render unchanged).
- Reuses `scatterInteriorCover` / open-plaza margins for canyon cover; shared `createDescendingRampRoom` for spire parity.

## Debug scenarios

| Scenario | Gating | Normal path | Invariants |
|----------|--------|-------------|------------|
| `sunken-canyon-stage` | `DEBUG_SCENARIOS` + `isDebugScenarioAllowed` (dev/harness only) | Select `sunken_canyon` quest → deploy → `applyLayoutForQuest` + `assignRunSpawnPositions` / `firstRoomPosition` on plateau | Uses same layout quest path and `spawnEnemies()` as live deploy |
| `sunken-canyon-floor` | Same | Descend ramps from plateau spawn | Uses `applyLayoutForQuest`; teleports to canyon center for QA only — does not skip server validation in normal play |

Neither scenario is reachable without the debug socket handler / harness `emitScenario`. `sunken-canyon-floor` omits `spawnEnemies()` (visual shortcut only); normal deploy still spawns via `startDungeonRun`.

## Code quality

- Focused changes across `dungeon.js`, `progression.js`, `simulation.js`, client `dungeon.js` / `renderer.js`, `quests.js`.
- No dead exports observed; `stageMeta` consumed for spawn and debug placement.
- Six commits since baseline `c7f10fc` on branch `auto/137-world-sunken-canyon-stage`, logically split by sub-ticket.

## Integration notes

- `sunken_canyon` appears in `listQuests()` / integration tests (`training_caverns`, `crystal_rescue`, `arena_trials`, `sunken_canyon`).
- Harness proxy port alignment (commit 05) is infra-only; unrelated to layout correctness.

## Remaining gaps

None blocking. Runtime is clean; acceptance criteria are met in code and automated tests. Round-3 browser capture did not image the sunken-canyon stage itself (harness fallback) — filed as a nit, not a code gap.

VERDICT: PASS
