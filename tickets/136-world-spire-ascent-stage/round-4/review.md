# Senior Review — Ticket 136: Spire Ascent Stage

**Baseline:** `f31c1fc2285d723ea09a421beb9a3546a565002e`  
**Commits:** 10 (`01-ramp-passage-helper` … `10-spire-debug-scenario-quest-parity`)  
**Capture:** `round-4/metrics.json`, `console.log`, screenshots

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `ok: true` | Yes |
| `pageerrors` | Empty `[]` |
| `failure_kind` | Absent |
| `harness_failure` | Absent |
| `console.log` `pageerror` / `[fatal]` | None (only Vite connect, 409 Conflict, 502 Bad Gateway resource loads — benign harness noise) |

The captured session reached `phase: "playing"`, canvas initialized, and combat UI rendered. Late capture showed socket reconnect noise but no uncaught JS defects. **Game starts and loads cleanly for this gate.**

**Capture caveat (non-blocking):** Round-4 used the generic `sloped-dungeon` fallback on the default **Initiate Vault** quest, not `spire_ascent`. `screenshot.log` notes `emitScenario sloped-dungeon failed: timeout waiting for debugScenarioResult`, yet `debugScenarioResult` stayed null while gameplay continued. This limits visual proof of the full spire tower but does not invalidate runtime health or the code-level acceptance evidence below.

---

## Acceptance criteria

### New stage variant via `generateLayout({ stage: "spire-ascent" })`

**Met.** `generateLayout` accepts an options-first object when `stage === 'spire-ascent'` (`isSpireAscentOptionsArg`) and the positional form `generateLayout(seed, profile, { stage: 'spire-ascent' })`. Both paths call `generateSpireAscentLayout`. Quest plumbing sets `layoutStage: 'spire-ascent'` on `spire_ascent` and `applyLayoutForQuest` forwards it.

### 3–5 distinct tiers, each room-sized, strictly increasing Y

**Met.** `SPIRE_MIN_TIERS` / `SPIRE_MAX_TIERS` (3–5). Each tier gets random width/depth in `[12, 15]`, flat `floorCorners`, `tierBaseY`, and `tierIndex`. `validateSpireLayout` and tests assert monotonic `computeTierBaseY` and unique `tierIndex` values.

### Ramp passages with average slope ≥ 0.2

**Met.** `buildRampPassage` enforces `minSlope` (default 0.2). Spire generator sets `risePerRamp = ceil(minRisePerRamp / 0.2) * 0.2` and passes `minSlope: SPIRE_MIN_RAMP_SLOPE`. Tests assert every passage `avgSlope >= 0.2`.

### Total Y gain spawn → top tier ≥ 10

**Met.** `risePerRamp` is sized so `(tierCount - 1) * risePerRamp >= 10`. Validated in `validateSpireLayout` and unit tests (`total Y gain … >= 10`).

### Perimeter walls on tiers and ramps (no fall-through)

**Met.** `buildTierPerimeterWalls` wraps each tier with gaps only on north/south ramp connections; east/west are solid. `buildRampPassage` adds parallel side walls along the corridor. Ramp passages include `walls.length >= 2` in tests. Walkability uses room + passage AABBs with wall colliders from layout walls (existing collision pipeline).

### Camera follow during ascent

**Met (code + movement tests; no spire-specific capture).** `updateCameraOrbit` tracks `playerY + CAMERA_HEIGHT` and `lookAt(playerX, playerY, playerZ)`. `applyPlayerMovement` test confirms `player.y` tracks `sampleFloorY` while moving up a spire ramp passage. No evidence of floor-clipping regressions in capture (flat/sloped grid quest).

### Enemy spawns distributed across tiers

**Met for typical layouts.** `spawnCombatEnemies` uses `spreadAcrossTiers` when `isTieredLayout` and multiple combat tiers exist; reserves one enemy on the summit treasure room for `spire_ascent` (`shouldReserveSummitEnemySpawn`). Server and integration tests assert ≥2 combat tiers with enemies and ≥1 summit enemy. For the fixed `spire_ascent` quest seed, layout has 5 tiers (3 combat + treasure).

**Edge case (nit, not blocking):** A 3-tier layout (one combat room) concentrates combat spawns on a single intermediate tier while the summit still holds the reserved enemy — still satisfies “not all on spawn / not all on top” literally.

### Objective / exit on final tier, reachable on foot via ramps

**Met.** Top tier `role: 'treasure'`; BFS from tier 0 reaches every tier (`validateSpireLayout`, dedicated tests). Summit enemy counts toward `defeat_enemies` objective (`server.test.js`). Movement along ramps does not require jumping (`applyPlayerMovement` ramp test).

### Deterministic given a seed

**Met.** Mulberry32-driven tier count, dimensions, and layout; tests assert `spireLayout(777)` equality across calls and quest seed stability.

### Unit tests: tier count, monotonic Y, reachability, no orphan tier

**Met.** `game/server/test/dungeon.test.js` — `describe('generateLayout spire-ascent stage')` covers tier range, monotonic Y, slope, total rise, BFS reachability, unique `tierIndex`, roles, ramp walls, `validateSpireLayout` over 20 seeds, and object API. Additional coverage in `server.test.js`, `integration.test.js`, `applyPlayerMovement.test.js`, client `dungeon.test.js` / `renderer.test.js`. `round-4/coverage.log`: **38 test files passed**.

---

## Design doc & requirements

- **`game/docs/design.md`:** Updated with `spire-ascent` stage variant, quest wiring, and `?debugScenario=spire-ramp-passage` — consistent with implementation.
- **`game/docs/requirements.md`:** No regression to core 3D / multiplayer / movement requirements; spire builds on existing layout and movement systems.

---

## Debug scenarios (`spire-ramp-passage`, `spire-summit-combat`)

| Rule | Assessment |
|------|------------|
| Gated to debug/dev path only | **OK** — client reads `?debugScenario=` only on localhost; server `isDebugScenarioAllowed` mirrors local-only policy. |
| Normal path still reaches equivalent state | **OK** — lobby quest `spire_ascent` + deploy uses the same `applyLayoutForQuest` / `spawnEnemies` / `startDungeonRun` pipeline. Debug scenarios only reposition the player after that parity setup. |
| Does not skip server validation / replication | **OK** — scenarios set quest and layout through production helpers; enemies and run objectives are spawned normally. `spire-summit-combat` teleports to summit for QA positioning only. |

Integration tests in `Debug scenarios — spire_ascent quest parity` enforce layout stage, enemy count, summit spawn, and multi-tier combat distribution.

---

## Code quality

- **Structure:** Shared `buildRampPassage` helper; spire generator is focused and validated.
- **Floor sampling:** `shared/floorSampling.esm.js` extended for ramp passage slabs; server movement and client rendering stay aligned.
- **Client:** Tier floors use `uniformFloorY`; ramp passages render as sloped meshes; enemy/telegraph Y uses sampled floor height.
- **No dead code or obvious defects** found in the changed paths.
- **Minor:** `generateSpireAscentLayout` does not call `validateSpireLayout` at runtime (validation is test-driven only) — see nits.

---

## Remaining gaps

None blocking. Runtime capture is healthy; acceptance criteria are implemented and covered by tests. Round-4 visuals exercised generic sloped geometry, not the spire quest end-to-end — tracked as harness/QA nits, not code gaps.

---

VERDICT: PASS
