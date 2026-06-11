# Server: count only encounter hostiles toward stage_boss defeatedEnemies

`stage_boss.onEnemyDefeated` currently increments `defeatedEnemies` for every enemy removed in `removeDeadEnemies`, including scripted wave grunts and throwers that are unrelated to the stage-boss encounter. Scope kill counting to the encounter boss (`run.encounter.bossEnemyId`) and encounter adds spawned by `stage_boss.spawnQuestEntities`.

## Acceptance Criteria

- Killing a scripted-wave enemy on a `stage_boss` run (e.g. a dock grunt with `scriptedWave` set) leaves `run.objective.defeatedEnemies` at `0` while `bossDefeated` stays `false` and `run.encounter.phase` stays `dormant`.
- Killing encounter adds spawned via `spawnQuestEntities` still increments `defeatedEnemies` (up to `addCount`).
- Killing the encounter boss while the encounter is active increments `defeatedEnemies` and sets `bossDefeated` through the existing `onStageBossDefeated` path.
- `game/server/test/stage_boss_kill_count.test.js` still passes: after clearing adds, activating, and killing the boss, `defeatedEnemies` equals `1 + addCount` and `buildRunSummary('victory').defeatedEnemies` matches.
- A new or extended server test (fixture quest is fine) asserts that a non-encounter kill does not advance `defeatedEnemies` on a deployed `stage_boss` run.

## Technical Specs

- **`game/server/objectives.js`**
  - In `stage_boss.spawnQuestEntities`, tag each encounter add spawned in the `addCount` loop with a boolean flag (e.g. `encounterHostile: true`). The boss is already identifiable via `run.encounter.bossEnemyId`.
  - Replace the blind `onEnemyDefeated` increment with logic that only applies when the caller passes encounter-scoped kills, or make `onEnemyDefeated` a no-op and rely on filtered counts from `removeDeadEnemies` / `tryActivateEncounter`.
- **`game/server/encounters.js`** (or `objectives.js` if simpler)
  - Add a helper such as `countStageBossObjectiveKills(dyingEnemies, run)` that returns how many dying enemies count toward the stage-boss counter: the boss (`id === run.encounter.bossEnemyId`) and enemies marked `encounterHostile`, excluding scripted-wave and bulk-spawn foes.
- **`game/server/progression.js`**
  - In `removeDeadEnemies`, when `run.objective.type === 'stage_boss'`, call `recordEnemyDefeated` with the filtered count from the helper instead of the raw `removed` total.
  - Leave the existing `tryActivateEncounter` → `recordEnemyDefeated(deadAddCount)` path intact for pre-activation add corpses.
- **`game/server/test/stage_boss_defeat.test.js`** (and any tier-2 tests that call `recordEnemyDefeated(5)` expecting a blind increment)
  - Update expectations: generic `recordEnemyDefeated(n)` must not inflate `defeatedEnemies` on `stage_boss` runs unless those kills are encounter-scoped through the real removal path.

## Verification: code
