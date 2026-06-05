# 01 — Canyon vertical stage-boss spawn

Ensure the reusable `stage_boss` spawn path produces a vertically distinct canyon encounter: dormant miniboss on the `canyon_monolith` landmark in the canyon band (low floor), with regular adds split across plateau and canyon elevations via the existing sunken-canyon spawn helpers.

## Acceptance Criteria

- A test harness quest with `objectiveType: 'stage_boss'` and `encounter: { bossType: 'miniboss', landmark: 'canyon_monolith', addCount: 4 }` on a rigid `sunken-canyon` layout spawns exactly one miniboss at the monolith `(x, z)` and `addCount` adds (no bulk `defeat_enemies` pack).
- The stage boss sits in the canyon band; at least one add spawns on the plateau band and at least one on the canyon band (vertical split).
- `sampleFloorY(layout, boss.x, boss.z)` for the boss is strictly lower than `sampleFloorY(layout, plateauAdd.x, plateauAdd.z)` for a plateau add — proving vertical separation, not just horizontal offset.
- `run.encounter.bossEnemyId` is wired to the spawned boss on `startDungeonRun()`; encounter phase starts `dormant`.
- No changes to `canyon_descent` quest catalog yet (fixture quest only); `pnpm test:quick` passes.

## Technical Specs

- **`game/server/test/canyon_stage_boss_spawn.test.js`** (new) — Fixture quest + rigid `generateLayout(seed, 'sunken-canyon', { layoutMode: 'rigid' })`; deploy via `spawnEnemies` + `startDungeonRun` pattern from `arena_trials_tier2.test.js` / `stage_boss_objective.test.js`. Helpers: `roomAt` / band lookup, `sampleFloorY` from `shared/floorSampling.esm.js` (or server bridge).
- **`game/server/objectives.js`** — Only if needed: ensure `stage_boss.spawnQuestEntities` passes `spawnIndex`/`addCount` through to `ctx.pickEnemySpawnPosition` so `pickSunkenCanyonEnemySpawn` can reserve plateau slots (should already work; fix only if tests fail).
- **`game/server/progression.js`** — Only if needed: tune `pickSunkenCanyonEnemySpawn` plateau-slot logic for small `addCount` values used by stage bosses (e.g. guarantee ≥1 plateau add when `addCount >= 2`).
- Reuse ticket 258 encounter wiring (`setEncounterBoss`, `ENCOUNTER_PHASES`); do not reimplement trigger/lock/defeat hooks.

## Verification: code
