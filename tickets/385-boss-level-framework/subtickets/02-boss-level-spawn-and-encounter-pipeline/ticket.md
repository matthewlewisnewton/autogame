# Boss-level spawn and encounter pipeline

Wire boss-level quests through the existing `stage_boss` objective and ticket-258 encounter framework so deploy spawns only the designated boss (plus optional `addCount` supports) in the `boss-arena` layout—no bulk combat waves, scripted room waves, or quest-script spawns.

## Acceptance Criteria

- Deploying a boss-level quest (`levelKind: 'boss_level'`, `objectiveType: 'stage_boss'`, `layoutProfile: 'boss-arena'`) produces `run.objective.type === 'stage_boss'`, `run.encounter` present with `phase: 'dormant'`, and exactly one boss enemy whose `id === run.encounter.bossEnemyId`.
- Live enemy count after deploy equals `1 + encounter.addCount` (default `addCount: 0`); no extra grunts from bulk spawn, `getQuestScript`, or `scriptedEncounters` runtime.
- Walking a player within `ENCOUNTER_TRIGGER_RADIUS` of the boss anchor activates the encounter (`phase: 'active'`, `locked: true`); killing the boss clears the encounter and completes the run objective (`bossDefeated` / `encounter.phase === 'cleared'`).
- `isBossLevelQuest` tiers are excluded from scripted-encounter init and quest-script `run_start` wave firing in `progression.js` `startDungeonRun()` (boss levels must not spawn clearing waves).
- Existing non-boss-level `stage_boss` quests (`arena_trials` Tier 2, `training_caverns` Tier 2, etc.) behave unchanged.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`** — In `startDungeonRun()` / `spawnEnemies()`, guard scripted-encounter and quest-script branches with `!isBossLevelQuest(quest)` (import helper from `quests.js`). Ensure `createRunState()` still attaches `run.encounter` when `quest.encounter` is set.
- **`game/server/objectives.js`** — Confirm `stage_boss.spawnQuestEntities` resolves the boss on `arena_dais` in `boss-arena` layouts (no code change expected if landmark exists; add a focused test if a fallback bug is found).
- **`game/server/encounters.js`** — Reuse existing activation/clear paths; no duplicate state machine.
- **`game/server/test/boss_level_spawn.test.js`** (new) — Synthetic boss-level fixture quest + `boss-arena` layout: deploy spawn counts, dormant boss wiring, proximity activation, boss kill → victory objective. Mirror patterns from `stage_boss_objective.test.js` and `encounter_trigger_lock.test.js`.
- **`game/server/test/stage_boss_objective.test.js`** or **`game/server/test/arena_trials_tier2.test.js`** — Regression assertion that a non-boss-level `stage_boss` tier still spawns adds and skips bulk combat as before.

## Verification: code
