# 06 — Fix stage-boss debug scenarios

Rewire `stage-boss-dormant` and `stage-boss-active` so they shortcut into the real Arena Trials Tier 2 `stage_boss` run (same quest metadata, `createRunState()` encounter construction, and configured `addCount`) instead of hand-building a Tier 1 substitute state. After the normal deploy path, apply only minimal positioning/HP tweaks and use `tryActivateEncounter` for the active shortcut.

## Acceptance Criteria

- Both scenarios unlock/select `arena_trials` Tier 2, apply the Tier 2 rigid layout, call `enterPlayingPhase()` + `startDungeonRun()`, and leave `run.questTier === 2`, `run.objective.type === 'stage_boss'`, and `run.encounter` created by the normal run path (not manually assigned afterward).
- `run.objective.addCount` and `run.questName` match `getQuest('arena_trials', 2)` catalog metadata; enemy count is `1 + encounter.addCount` with the boss ID wired in `run.encounter.bossEnemyId`.
- `stage-boss-dormant`: after setup, `run.encounter.phase === 'dormant'`, `run.encounter.locked === false`, all configured adds are alive, and the player is positioned beyond `ENCOUNTER_TRIGGER_RADIUS` from the `arena_dais` anchor so proximity does not auto-activate.
- `stage-boss-active`: after setup, non-boss adds are cleared and `tryActivateEncounter(state)` succeeds (or equivalent normal trigger path), yielding `run.encounter.phase === 'active'` and `run.encounter.locked === true`; boss may be left at 1 HP for quick defeat QA only after activation.
- No manual replacement of `state.run.objective` or `state.run.encounter` after `startDungeonRun()`; remove the Tier 1 `applyLayoutForQuest(..., 1)` branch and the hand-built boss/support spawn block.
- `game/server/test/debug-scenarios.test.js` adds focused tests for both scenarios asserting Tier 2 quest/run shape, encounter phase/lock, and enemy counts; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/debugScenarios.js`**
  - Give `stage-boss-dormant` and `stage-boss-active` dedicated early-return setup blocks modeled on `arena-trials-tier-2`: `unlockQuestTier(accountId, 'arena_trials', 2)`, set `selectedQuestId`/`selectedQuestTier`, `applyLayoutForQuest`, ready player, `enterPlayingPhase`, init hand if needed, clear enemies/loot, `spawnEnemies()` + `startDungeonRun()` (or the same sequence `arena-trials-tier-2` uses).
  - **Dormant tweak:** resolve `arena_dais` from `state.layout.landmarks`; place player at anchor + offset > `ENCOUNTER_TRIGGER_RADIUS` (8) on X or Z; do not call `tryActivateEncounter`.
  - **Active tweak:** kill/remove non-boss enemies (or move player within trigger radius), call `tryActivateEncounter(state)` from `encounters.js`; optionally set boss `hp = 1` after activation; position player near the dais.
  - Delete the shared-path Tier 1 hook (`selectedQuestTier = 1` + `applyLayoutForQuest(..., 1)`) and the downstream `else if` block that manually sets `run.objective`, `createEncounterState`, and custom `spawnEnemy` calls.
  - Skip `ensureNearbyEnemy` for these scenarios (do not add stray grunts).
- **`game/server/test/debug-scenarios.test.js`**
  - New `describe` blocks for `stage-boss-dormant` and `stage-boss-active` behind `ALLOW_DEBUG_SCENARIOS=1`, mirroring the `arena-trials-tier-2` harness pattern (`connectClient`, emit `debugScenario`, assert `stateUpdate` / lobby state).
  - Import `getQuest`, `ENCOUNTER_TRIGGER_RADIUS`, `ENCOUNTER_PHASES` as needed for assertions.

## Verification: code
