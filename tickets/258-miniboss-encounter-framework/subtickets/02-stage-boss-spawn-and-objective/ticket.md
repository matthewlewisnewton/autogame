# 02 — Stage-boss objective and designated spawn

Add a reusable `stage_boss` objective type that spawns a designated miniboss stage boss (with existing per-player HP scaling from ticket 270) and records its id on `run.encounter`, instead of scattering minibosses through the generic `defeat_enemies` bulk spawn.

## Acceptance Criteria

- `OBJECTIVE_DEFS.stage_boss` exists in `objectives.js` with `createObjective`, `isComplete`, `skipBulkCombatSpawn`, and `spawnQuestEntities` hooks registered via `getObjectiveDef`.
- Quest tier definitions can opt in with `objectiveType: 'stage_boss'` plus encounter metadata (e.g. `encounter: { bossType: 'miniboss', landmark: 'arena_dais', addCount: N }`) without editing `progression.js` type switches.
- On run open, `spawnQuestEntities` spawns exactly one stage boss at the layout landmark position (fallback: room center for layouts without the landmark) via `spawnEnemy`, sets `run.encounter.bossEnemyId` to that enemy's `id`, and spawns `addCount` regular adds from the quest `enemyPool` (not counting the boss toward `defeat_enemies` totals).
- The stage boss enemy has `type === 'miniboss'`; with 5+ active players its `hp`/`maxHp` are scaled per `difficultyScaleFactor` + `DIFFICULTY_MINIBOSS_HP_PER_PLAYER` (ticket 270 — no duplicate scaling logic).
- `isComplete` returns true only after the designated boss is defeated (`run.encounter.phase === 'cleared'` or objective counter driven by boss death in 04); non-boss kills alone do not complete the run.
- `isValidObjectiveType('stage_boss')` is true; `objectives.test.js` asserts every live quest `objectiveType` remains registered.
- Automated tests cover spawn placement, boss designation, add spawn count, and scaled miniboss HP at elevated party size.

## Technical Specs

- **`game/server/objectives.js`** — New `stage_boss` registry entry:
  - `createObjective(quest)` → `{ type: 'stage_boss', label, bossDefeated: false }` (or equivalent minimal progress fields).
  - `skipBulkCombatSpawn: () => true`.
  - `spawnQuestEntities(layout, rng, quest, gameState, ctx)` — resolve landmark coords from `layout.landmarks` (`landmark` string match), call `ctx.spawnEnemy` for boss + adds; call `setEncounterBoss` from `encounters.js`.
- **`game/server/quests.js`** — Document encounter metadata shape on quests that will use the framework (actual quest id wiring lands in sub-ticket 05); export helpers if needed (`getEncounterConfig(quest)`).
- **`game/server/encounters.js`** — Use `setEncounterBoss` from 01.
- **`game/server/test/stage_boss_objective.test.js`** (new) — Direct `spawnEnemies` / `spawnQuestEntities` harness with open-plaza layout + synthetic `run.encounter`; party-size HP scaling cases mirroring `miniboss_hp_scaling.test.js`.
- Reuse `spawnEnemy` in `progression.js` (do not fork HP math). Reuse `pickEnemySpawnPosition` / `pickFloorSpawnPosition` for adds on open-plaza layouts.

## Verification: code
