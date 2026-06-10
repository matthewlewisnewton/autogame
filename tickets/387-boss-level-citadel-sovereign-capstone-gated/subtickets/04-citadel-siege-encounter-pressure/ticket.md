# Citadel Siege capstone encounter pressure retune

Retune `citadel_siege` so its **total encounter pressure** (boss durability plus support adds and their damage output) clearly exceeds every Tier-II stage-boss level among the three capstone prerequisites (`spire_ascent`, `arena_trials`, `frost_crossing`). Add a regression test that compares whole-encounter difficulty, not only `citadel_sovereign.attackDamage`.

## Acceptance Criteria

- `citadel_siege` tier 1 `encounter.addCount` is **greater than 0** and strictly higher than `arena_trials` tier 2 (`4`); the deployed run spawns **1 boss + addCount** dormant enemies (not a lone sovereign).
- `citadel_sovereign.hp` remains **420** (defeat-window ceiling per `game/docs/design.md`); do not raise boss HP to inflate difficulty.
- After deploy with a fixed seed, **total encounter HP** (`sum` of spawned enemy `hp` from `ENEMY_DEFS`) for `citadel_siege` is **strictly greater** than the same metric for each benchmark: `spire_ascent:2`, `arena_trials:2`, and `frost_crossing:2` (use the same seed per quest for fair comparison).
- The same deploy comparison shows **total encounter attack pressure** (`sum` of spawned enemy `attackDamage`) for `citadel_siege` is **strictly greater** than all three Tier-II benchmarks above.
- `formatObjectiveSummary` / quest-board copy reflects supports when `addCount > 0` (reuse existing `boss_level` `defeatBossLevelWithSupports` theme path — e.g. **Defeat Citadel Sovereign and N supports**).
- Quest description, briefing, and `run_start` dialogue mention the sovereign **with** marked supports (not “alone on the dais”).
- `citadel_siege.test.js` deploy test no longer asserts a lone boss; victory flow still completes when the active boss is killed (supports may remain per existing stage-boss rules).
- `boss_level_reuse.test.js` `BOSS_LEVEL_QUESTS` entry for `citadel_siege` matches the new `addCount` and `objectiveSummary`.
- `debug-scenarios.test.js` `citadel-siege-boss` scenario expects the updated `addCount` and enemy count.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Retune `citadel_siege` tier 1:
  - Raise `encounter.addCount` (suggested **6** to beat `spire_ascent` tier 2’s `5`; adjust if pool weights require a different count to clear the HP/damage benchmarks).
  - Strengthen `enemyPool` for capstone adds (e.g. include `miniboss` and/or other higher-pressure types — not only `grunt`/`skirmisher`).
  - Update `description`, `client.briefing`, and `dialogue` copy to describe boss **with** supports.
- **`game/server/test/citadel_siege.test.js`** — Update catalog/deploy assertions (`addCount`, enemy length, objective summary). Add a **`measureDeployedEncounterPressure(questId, tier, seed)`** helper (deploy via existing `spawnEnemies` + `startDungeonRun` pattern) returning `{ totalHp, totalAttackDamage, enemyCount }`. New regression test **`citadel_siege exceeds Tier-II prerequisite encounter pressure`** that compares capstone vs `spire_ascent:2`, `arena_trials:2`, and `frost_crossing:2` on both HP and attack sums.
- **`game/server/test/boss_level_reuse.test.js`** — Update `citadel_siege` `addCount` and `objectiveSummary` in `BOSS_LEVEL_QUESTS`; parametrized spawn-length test must pass.
- **`game/server/test/debug-scenarios.test.js`** — Update `citadel-siege-boss` expectations for `run.objective.addCount` and `enemies.length`.
- **`game/client/test/questBoard.test.js`** — If objective summary changes, update the `citadel_siege` fixture assertion to the new supports copy.
- **Do not modify** sub-tickets 01–03 (`.passed`) or retune `citadel_sovereign` per-hit stats unless required for the encounter-pressure test to pass; the gap is encounter composition, not lone-boss `attackDamage`.

## Verification: code
