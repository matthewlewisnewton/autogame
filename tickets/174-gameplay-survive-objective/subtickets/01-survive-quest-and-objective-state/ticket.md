# Survive quest definition and run-objective state

Add a new `survive` objective type to the quest system and run-state model: a
`QUEST_DEF` carrying `objectiveType:'survive'`, `totalSpawns`, and
`minibossCount`, plus a `createRunState` branch that builds a `survive`
objective and the completion/progress wiring so the run ends when every spawned
enemy has been defeated. (Staggered spawning itself is sub-ticket 02; this
sub-ticket only establishes the data model and completion logic.)

## Acceptance Criteria

- `game/server/quests.js` defines a new entry in `QUEST_DEFS` with
  `objectiveType: 'survive'`, a finite `totalSpawns` (e.g. 10), a finite
  `minibossCount` (e.g. 2, and `< totalSpawns`), plus `id`, `name`,
  `description`, `rewardCurrency`, and `layoutProfile` fields consistent with the
  existing quest defs. It is returned by `listQuests()` and `getQuest(id)`.
- `createRunState()` in `game/server/progression.js` has a branch for
  `quest.objectiveType === 'survive'` that returns a run whose `objective` has
  `type: 'survive'`, a descriptive `label`, `totalSpawns`, `minibossCount`,
  `spawnedEnemies: 0`, `defeatedEnemies: 0`, and `totalEnemies` set equal to
  `totalSpawns` (so the existing in-run objective HUD and completion fallback
  reuse the same field names).
- `recordEnemyDefeated(count)` increments `defeatedEnemies` for a `survive`
  objective (its early-return guard no longer skips `survive`), and does NOT
  affect runs of other objective types.
- `isRunObjectiveComplete(objective)` returns true for a `survive` objective
  once `defeatedEnemies >= totalSpawns` (equivalently `>= totalEnemies`) and
  false before that.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/server/quests.js`: add the `survive` quest to the `QUEST_DEFS` object.
  Pick a `layoutProfile` already supported by the layout generator (e.g.
  `open-plaza`). Do not change the module's exported function signatures.
- `game/server/progression.js`:
  - `createRunState()` (~1274): add the `survive` branch described above,
    mirroring the structure of the existing `collect_items` / `defeat_enemies`
    branches. Keep `totalEnemies === totalSpawns` so the in-run HUD
    (`main.js` `obj.defeatedEnemies / obj.totalEnemies`) and the
    `isRunObjectiveComplete` fallback work without a client change here.
  - `recordEnemyDefeated()` (~1560): change the guard so it counts defeats for
    both `defeat_enemies` and `survive` objective types.
  - `isRunObjectiveComplete()` (~1572): confirm/ensure `survive` completes via
    the `defeatedEnemies >= totalEnemies` path (add an explicit `survive` case
    if clearer).
- Prefer adding focused unit tests next to the existing objective tests in
  `game/server/test/server.test.js` (e.g. a survive run completes only after
  `totalSpawns` defeats).

## Verification: code
