# Senior Review: Spire Ascent Stage (ticket 136)

**Baseline:** `aa963b34eaad3701c4de5ea56af2bb4b368d178d`  
**Commits:** `2a6c272` (layout generator), `c007be7` (client render), `b1c49b6` (quest spawns & debug scenarios)  
**Reviewer scope:** Holistic acceptance against `ticket.md`, `game/docs/design.md`, live `game/` tree, round-1 capture artifacts.

---

## Runtime health (capture gate)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` empty, no `failure_kind: browser_pageerror` | Pass |
| `console.log` — no `pageerror` / `[fatal]` from game code | Pass (Vite connect, 409 on a resource, `[initScene]`, `[debugScenario] applied sloped-dungeon` only) |

The captured session started cleanly on `http://localhost:5174/`. No harness infrastructure failure block.

**Note:** Round-1 capture used the fallback plan and `sloped-dungeon` debug scenario, not the new spire-ascent stage. That limits visual proof for this ticket specifically (see nits), but does not invalidate the startup gate.

---

## Acceptance criteria

### New stage variant via `generateLayout({ stage: "spire-ascent" })`

**Met.** `generateLayout(seed, 'spire-ascent')` branches to `generateSpireAscent()` in `game/server/dungeon.js`. Profile registered in `LAYOUT_PROFILES`. Quest `spire_ascent` uses `layoutProfile: 'spire-ascent'` via `getLayoutProfileForQuest`.

### 3–5 distinct tiers, each room-sized, strictly stacked in Y

**Met.** `SPIRE_ASCENT.numTiersMin/Max` (3–5), tier sizes 12–15, `buildSpireTierRoom` with `band: 'tier'` and `tierIndex`. Tests assert tier count, size band, flat floors, and strict monotonic Y northward across seeds.

### Ramp passages with sloped `floorCorners`, average slope ≥ 0.2

**Met.** Tiers linked by `buildDescentRampRoom` (`axis: 'z'`, exported for reuse). `risePerRamp = max(minRampSlope * rampDepth, minTotalClimb / (numTiers - 1))` guarantees ≥ 0.2 rise/run. Client tests confirm ramps render as rotated sloped slabs.

### Total Y gain spawn → top exit ≥ 10 units

**Met.** With `minTotalClimb: 10`, per-ramp rise is at least `10 / (numTiers - 1)`, so bottom-to-top tier centre Y delta is ≥ 10 across seeds. Spawn uses `firstRoomPosition()` on `role: 'start'` (bottom tier centre); treasure/objective on top tier (`role: 'treasure'`). Walkability BFS confirms foot path from bottom tier centre to top tier centre without jumps.

### Perimeter walls on tiers and ramps (no walk-off)

**Met.** `buildSpireTierRoom` builds full west/east walls plus north/south segments with ramp-width gaps only at connectors. Ramps get side walls. Server tests assert bottom/top tier and ramp side wall coverage; client tests assert wall mesh count ≥ layout segments.

### Camera follow while ascending

**Met (architecturally).** Camera target Y follows `playerY + CAMERA_HEIGHT` (`renderer.js`); player Y follows `sampleFloorY` on slopes (ticket 117). New test in `game/client/test/camera-orbit.test.js` mirrors that formula for a +12 climb. No round-1 screenshot of spire ascent (nit), but no code path suggests spire-specific camera breakage.

### Enemy spawns distributed across tiers

**Met.** `pickSpireAscentEnemySpawn` in `progression.js` reserves slots for bottom, middle (when present), and top bands before cycling. `spire_ascent_spawn.test.js` verifies bottom/middle/top presence for 3-tier and 4–5-tier layouts, no spawns on ramp rooms, and determinism across seeds.

### Objective / exit on final tier, reachable on foot from spawn

**Met.** Top tier `role: 'treasure'`; client places treasure marker at sampled floor Y. Quest `spire_ascent` uses `defeat_enemies` (purge hostiles). Crystals/loot for collect-style objectives also pin to top tier when applicable. Reachability covered by layout walkability tests.

### Deterministic given a seed

**Met.** `mulberry32(seed)` throughout `generateSpireAscent`; deep-equal layout test; spawn tests fix seed.

### Unit tests: tier count, monotonic Y, ramp graph reachability, no orphans

**Met.** `game/server/test/dungeon.test.js` describe block `generateLayout(seed, 'spire-ascent')` (10 cases). Additional `spire_ascent_spawn.test.js` and client `spire-ascent floors & treasure marker` tests.

---

## Design & foundation consistency

- Aligns with `game/docs/design.md` floor geometry: `floorCorners`, `sampleFloorY`, sloped movement on ramps.
- No conflict with core loop or lobby/deploy flow; `spire_ascent` appears in quest list (`integration.test.js`, `server.test.js`).
- Reuses room mesh primitives and existing treasure marker pattern (same as sunken-canyon / standard dungeons).

---

## Debug scenarios

| Scenario | Gating | Normal path equivalent | Short-circuit risk |
|----------|--------|------------------------|------------------|
| `spire-ascent` | `DEBUG_SCENARIOS` + localhost / `ALLOW_DEBUG_SCENARIOS` / non-production; client URL `?debugScenario=` on localhost only | Deploy with `spire_ascent` quest: `applyLayoutForQuest` + `spawnEnemies` + `startDungeonRun` | Low — mirrors canyon_descent pattern |
| `spire-ascent-stage` | Same | Layout-only QA; comment notes full climb via quest | Layout-only (no enemies); does not weaken deploy validation |

Both are debug-only entry points; normal gameplay reaches equivalent state through lobby quest selection and deploy.

---

## Code quality

- Focused diff (~985 lines across 3 commits): generator, client render tests, progression spawns, quest def, debug wiring.
- `buildDescentRampRoom` exported for ticket 137 reuse.
- No dead code observed; exports wired in `dungeon.js` module.exports.
- Independent `pnpm test:quick`: **62 files, 1472 tests passed** (reviewer run).

---

## Capture & coverage notes

- Screenshots show generic lobby/play and `sloped-dungeon`, not spire geometry — harness fallback, not a code defect.
- `coverage.log` includes `spire_ascent_spawn.test.js` and spire layout/client tests in the vitest run.

---

## Remaining gaps

No blocking gaps. All acceptance criteria are satisfied in code and covered by unit/integration tests; the game starts and runs without page errors in round-1 capture.

---

VERDICT: PASS
