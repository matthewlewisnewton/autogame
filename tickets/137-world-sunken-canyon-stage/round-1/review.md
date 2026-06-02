# Senior review: 137 — Sunken Canyon Stage

**Baseline:** `9abbd7e6c30aade3dab48fc2556a786884f50acb`  
**Commits:** `bfd4b61` (server layout), `d5db1cd` (client render), `61d3546` (quest/spawns/debug)  
**Capture:** `round-1/metrics.json`, `console.log`, screenshots (fallback `sloped-dungeon` plan)

---

## Runtime health (gate)

| Check | Result | Evidence |
|-------|--------|----------|
| `metrics.json` present, `ok: true` | **PASS** | Servers started; `pageerrors: []` |
| `pageerrors` / `failure_kind` | **PASS** | Empty; no `browser_pageerror` |
| `console.log` fatal/pageerror | **PASS** | No `pageerror` or `[fatal]` lines; only Vite connect, benign 409 on auth, `[initScene]`, `[debugScenario] applied sloped-dungeon` |
| Harness infra failure | **N/A** | No `harness_failure` block |

The captured run proves the game loads and plays without uncaught browser exceptions. The smoke flow used the generic `sloped-dungeon` debug scenario (crowded/training layout before scenario swap), not the sunken-canyon stage itself — see nits for capture coverage.

**Vitest (reviewer re-run):** `pnpm test:quick` — 1437 tests passed across 60 files.

---

## Acceptance criteria

### New stage variant: `generateLayout(..., 'sunken-canyon')`

**PASS.** `generateLayout` branches to `generateSunkenCanyon(seed)` when `profile === 'sunken-canyon'`. Profile is registered in `LAYOUT_PROFILES`. API matches project convention (`generateLayout(seed, profile)` rather than `{ stage: ... }` object form in the ticket prose).

### Two elevation bands: upper plateau + large canyon floor (≥ 4× default room)

**PASS.** One flat `band: 'plateau'` room (13×13, uniform `yHigh`) and one flat `band: 'canyon'` room (32×32 = 1024 area, ≥ 4×182). Ramps are connector rooms with sloped `floorCorners`, not a third flat play band — consistent with “two elevation bands” in the design. Unit tests assert plateau/canyon dimensions and flat corners at sampled Y.

### 2–3 ramp paths, `floorCorners`, average slope ≥ 0.15, foot-reachable

**PASS.** `numRamps = 2 + floor(rng()*2)` from three X offsets; each ramp built via shared `buildDescentRampRoom` with non-uniform corners and z-axis descent. Tests enforce slope ≥ 0.15, 2–3 ramps over 30 seeds, and full reachability (`countReachableRooms`, grid BFS plateau → canyon center). Live check (seed 42): 3 ramps, slope ≈ 0.417, `yDrop = 10`.

### Total Y drop plateau → canyon center ≥ 8

**PASS.** `SUNKEN_CANYON.yDrop = 10`; tests loop multiple seeds with `sampleFloorY` at plateau vs canyon centers.

### Outer walls enclose both bands; no walk-off gaps

**PASS.** Perimeter walls on plateau (N/W/E solid, S with ramp gaps) and canyon (S/W/E solid, N with ramp gaps). Tests assert solid north/west/east on plateau and south/west/east on canyon. Cover pieces become colliders.

### Camera follow on both bands and ramps; plateau vista into canyon

**PASS (code + sub-ticket QA).** Client: `initScene` uses `sampleFloorY` for initial `camera.lookAt`; local player mesh Y from `sampleFloorY`; `updateCameraOrbit` tracks `playerY + CAMERA_HEIGHT`. Server movement snaps `player.y` to `sampleFloorY` on walk. Round-1 screenshots do not show the sunken-canyon layout (generic sloped-dungeon capture), but geometry places plateau ~10 units above canyon with open ramp mouths — no code path that would bury the camera underground at plateau spawn. Sub-ticket 02 signed off render/collision behavior.

### Enemy spawns: ≥ 1 plateau, majority canyon

**PASS.** `pickSunkenCanyonEnemySpawn` reserves 1–2 plateau slots then samples canyon; dedicated `sunken_canyon_spawn.test.js` asserts ≥1 plateau, majority canyon, never on `band: 'ramp'`. `canyon_descent` quest uses `enemyCount: 6`.

### Objective / exit on canyon floor, reachable on foot from plateau

**PASS.** Canyon room `role: 'treasure'`; client treasure marker at `sampleFloorY(canyon) + 0.75`. `spawnCrystals` / `spawnLoot` target canyon band only for sunken-canyon layouts. Reachability tests cover foot path to canyon center. `canyon_descent` is `defeat_enemies` (exit marker + purge objective, not crystals on plateau).

### Deterministic given a seed

**PASS.** `mulberry32(seed)` throughout; deep-equal layout test; spawn position determinism test.

### Unit tests: two bands, ramps, Y drop, slope, reachability

**PASS.** `describe("generateLayout(seed, 'sunken-canyon')")` (11 tests) plus client sunken-canyon render block (6 tests) plus `sunken_canyon_spawn.test.js` (5 tests). Integration/server tests include `canyon_descent` in quest list.

---

## Design alignment (`game/docs/design.md`)

**PASS.** Uses `floorCorners` and `sampleFloorY` per floor-geometry design; reuses `buildDescentRampRoom` (shared with spire direction) and open-plaza `scatterCoverInArena`. No changes to core combat/lobby loop.

## Foundation (`game/docs/requirements.md`)

**PASS.** No regression to 3D render, socket multiplayer, or movement sync contracts.

---

## Debug scenarios

| Scenario | Gating | Normal path equivalent | Invariants |
|----------|--------|------------------------|------------|
| `sunken-canyon` | `DEBUG_SCENARIOS` + harness `debugScenario` URL on localhost | Select **Canyon Descent** quest → deploy | Uses `applyLayoutForQuest('canyon_descent')`, `spawnEnemies()`, plateau spawn + `sampleFloorY` for `player.y` |
| `sunken-canyon-stage` | Same | Layout-only QA shortcut | Regenerates `generateLayout(seed, 'sunken-canyon')`, seats player on `start` room; no enemy spawn (render/collision only) |

Both are dev-only shortcuts; normal gameplay reaches the same layout via `canyon_descent`. Neither skips server validation or persistence paths beyond what other debug scenarios already do.

---

## Code quality

- Focused diff across `game/server/dungeon.js`, `progression.js`, `quests.js`, `index.js`, `game/client/dungeon.js`, `renderer.js`, and tests.
- No dead code or obvious logic bugs in spawn/layout paths.
- `buildDescentRampRoom` exported for reuse (136/137 pattern).
- Console capture clean; 409 on register is harness noise, not game defects.

---

## Remaining gaps

None blocking. All top-level acceptance criteria are implemented and covered by unit tests; the round-1 browser capture confirms general game health but not a sunken-canyon vista screenshot (tracked as a nit).

---

VERDICT: PASS
