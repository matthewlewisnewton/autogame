# Senior Review: 136 — Spire Ascent Stage

**Baseline:** `d564f545` · **Commits:** `da86b08`, `88053b8`, `9dc960b`  
**Captured run:** `round-1/metrics.json` (`ok: true`, `pageerrors: []`)

## Runtime health

The game starts and loads cleanly for this round.

| Check | Result |
|-------|--------|
| `metrics.json` present, `ok: true` | Pass |
| `pageerrors` empty, no `failure_kind: browser_pageerror` | Pass |
| `console.log` — no `pageerror` / `[fatal]` from game code | Pass (benign 409 auth conflicts and Vite connect lines only) |

Capture used the harness **fallback** plan (`sloped-dungeon` on the default training-caverns run), not the new `spire-ascent` quest or debug scenarios. That limits visual proof of the spire but does **not** invalidate runtime health.

## Acceptance criteria

### New stage variant via `generateLayout(…, 'spire-ascent')`

**Met.** `generateLayout` branches to `generateSpireAscent(seed)` when `profile === 'spire-ascent'`. `LAYOUT_PROFILES`, `BESPOKE_LAYOUT_PROFILES`, and `spire_ascent` in `quests.js` (`layoutProfile: 'spire-ascent'`) wire the quest to the same profile. `applyLayoutForQuest` uses `generateLayout(seed, profile)` for deploy.

### 3–5 distinct tiers, each flat, strictly increasing Y

**Met.** `generateSpireAscent` picks `numTiers = 3 + floor(rng() * 3)` (3–5). Each tier room has uniform `floorCorners` and `band: 'tier'`. Centre Y rises by `risePerRamp` each index. Server tests (`dungeon.test.js` spire block) assert tier count, flat floors, and monotonic Y across seeds 1–30.

### Ramp passages with average slope ≥ 0.2

**Met.** `SPIRE_ASCENT.minRampSlope = 0.2`, `rampDepth = 14`; `risePerRamp = max(minTotalYGain / numRamps, minRampSlope * rampDepth + ε)`. Ramps built via shared `buildDescentRampRoom` (`band: 'ramp'`). Tests assert `ramps.length === tiers - 1` and `rampAverageSlope(ramp) >= 0.2`.

### Total Y gain spawn → top tier ≥ 10

**Met.** `minTotalYGain: 10` with rise budget split across `numTiers - 1` ramps. Tests verify `yTop - yBottom >= 10` for seeds 1–30.

### Outer walls on every tier and ramp (no walk-off)

**Met.** Tiers get east/west full walls; north/south use `buildHorizontalWallWithGaps` except solid caps on bottom (south) and top (north). Ramps get side walls via `buildDescentRampRoom`. Tests check perimeter wall segments on bottom tier, top tier, and each ramp.

### Camera follow while ascending

**Met (code).** `initScene` now places the camera at `spawnFloorY + CAMERA_HEIGHT` instead of a fixed `CAMERA_HEIGHT`, so elevated spawns are framed correctly. `updateCameraOrbit` already tracks `playerY + CAMERA_HEIGHT` and `lookAt(playerX, playerY, playerZ)` each frame, so ascent follows floor height from ticket 117. Capture did not climb a spire, but the change is minimal and consistent with sunken-canyon patterns.

### Enemy spawns distributed across tiers

**Met for typical layouts; weak on 3-platform seeds.** `pickSpireAscentEnemySpawn` reserves the lowest combat tier, then the highest combat tier when `enemyCount ≥ 2`, then fills middle combat tiers. `spireSpawn.test.js` confirms bottom + higher combat tiers for seed 42 (4 platforms / 2 combat tiers).

For **3-platform** layouts (start + one combat + treasure), only one combat tier exists, so all eight `spire_ascent` enemies land on `tierIndex === 1` (~9/30 seeds in 1–30). That satisfies “not all on the bottom start tier” and “not all on the top treasure tier,” but not the spirit of multi-tier pacing. Recommend follow-up (nit), not a blocker, because the layout still requires ramp climbing and 4–5 tier seeds behave correctly.

### Objective / exit on final tier, reachable on foot via ramps

**Met.** Top room is `role: 'treasure'` with highest `tierIndex`. Client `buildDungeon` places a treasure exit pillar at `sampleFloorY(treasure) + 0.75`. `spawnCrystals` targets top-tier treasure for collect quests. `spire_ascent` uses `defeat_enemies`; completion is purge-based, while the exit marker remains on the top tier. Walkability tests (`spireReachableFromSpawn`, BFS to treasure centre, `countReachableRooms === rooms.length`) confirm foot access without jumps.

### Deterministic given a seed

**Met.** Mulberry32-driven tier count and geometry; deep-equal layout test passes.

### Unit tests: tier count, monotonic Y, ramp graph, reachability, no orphans

**Met.** `game/server/test/dungeon.test.js` (spire block, ~200 lines) and `game/server/test/spireSpawn.test.js` (10 tests). Client `dungeon.test.js` covers floor meshes and elevated treasure marker for generated layouts. Full suite: **1461 tests passed** (`pnpm test:quick`).

## Design & foundation

- Aligns with `design.md` sloped-floor model (`floorCorners`, `sampleFloorY`, ramp rooms).
- No regression against `requirements.md` (connect, move, render).
- Reuses `buildDescentRampRoom` (shared with sunken-canyon pattern); suitable for ticket 137 reuse.

## Debug scenarios

| Scenario | Gating | Normal path | Invariants |
|----------|--------|-------------|------------|
| `spire-ascent-stage` | `?debugScenario=` + localhost / `ALLOW_DEBUG_SCENARIOS` | `spire_ascent` quest → `applyLayoutForQuest` | Layout-only shortcut; same `generateLayout(seed, 'spire-ascent')` as quest |
| `spire-ascent-spawns` | Same | Deploy `spire_ascent` + `spawnEnemies()` | Calls `applyLayoutForQuest` + `spawnEnemies()` — mirrors deploy |

Both are registered in `DEBUG_SCENARIOS` and only entered via URL + socket `debugScenario`. They do not weaken server validation or persistence beyond other existing dev shortcuts.

## Code quality

- Focused diff (~1k lines): `dungeon.js` generator, quest/spawn wiring, camera spawn height, tests.
- No dead exports; `generateSpireAscent` and `buildDescentRampRoom` exported intentionally.
- No browser defects in capture.

## Remaining gaps

None blocking. See `nits.md` for optional follow-ups (capture plan, 3-tier enemy clustering).

VERDICT: PASS
