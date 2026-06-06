# Fix fire-cavern debug scenario run metadata

The `fire-cavern` debug deploy shortcut currently runs through the generic
`enterPlayingPhase` / `startDungeonRun` path with the default quest, then swaps
`selectedQuestId` and layout in a post-phase handler. That leaves stale
`state.run` fields (`questId`, `questTier`, `questName`, objective label/reward)
from the prior quest while the layout and enemies are Ember Descent / fire-cavern.
Refactor so the shortcut lands in the same run state a player reaches by selecting
Ember Descent tier-1 and deploying normally.

## Acceptance Criteria

- `debugScenario({ name: 'fire-cavern' })` succeeds and leaves the lobby in
  `gamePhase: 'playing'`.
- `state.selectedQuestId` is `'ember_descent'` and `state.selectedQuestTier` is
  `1`.
- `state.layout.profile` is `'fire-cavern'` with the quest's layout seed.
- **`state.run` matches the selected quest** (not the default/previous quest):
  - `state.run.questId` is `'ember_descent'`
  - `state.run.questTier` is `1`
  - `state.run.questName` equals `getQuest('ember_descent', 1).name`
  - `state.run.objective.type` is `'defeat_enemies'`
  - `state.run.objective.label` references the Ember Descent quest name
- Enemy count matches `getQuest('ember_descent', 1).enemyCount` after deploy.
- Player spawns on the rim start room with `player.y` aligned to
  `sampleFloorY(state.layout, player.x, player.z)`.
- `game/server/test/debug-scenarios.test.js` asserts all run-metadata fields
  above (not just `selectedQuestId` / layout / enemy types).
- Existing fire-cavern layout, quest, and theme tests continue to pass.

## Technical Specs

- `game/server/debugScenarios.js`:
  - Refactor the `fire-cavern` handler out of the generic post-`enterPlayingPhase`
    `else if` chain. Preferred pattern: an early `if (name === 'fire-cavern')`
    block (mirror `training-caverns-tier-2` / `canyon-descent-tier-2`) that:
    1. Sets `state.selectedQuestId = 'ember_descent'` and
       `state.selectedQuestTier = 1` **before** `enterPlayingPhase`.
    2. Calls `applyLayoutForQuest(state, 'ember_descent', 1)`.
    3. Positions the player on the rim via `firstRoomPosition()` and
       `resolveFloorY(sampleFloorY(...))`.
    4. Calls `enterPlayingPhase(lobby)`, initializes hand/deck if needed.
    5. Clears `state.enemies` / `state.loot`, `delete state.run` (and
       `state._pendingEncounterBossId` if present), `spawnEnemies()`, then
       `startDungeonRun()`.
    6. Emits `emitLobbyQuestUpdate` and returns `{ ok: true, scenario: name }`.
  - Acceptable alternative: keep the post-phase branch but after
    `applyLayoutForQuest` + `spawnEnemies()` explicitly
    `delete state.run` and call `startDungeonRun()` so run metadata is rebuilt
    from `ember_descent`.
  - Remove the old post-`enterPlayingPhase` `fire-cavern` branch so it cannot
    double-apply.
- `game/server/test/debug-scenarios.test.js`:
  - Extend the existing `debugScenario — fire-cavern` test to assert
    `state.run.questId`, `state.run.questTier`, `state.run.questName`,
    `state.run.objective.type`, `state.run.objective.label`, and
    `state.enemies.length === tier1Quest.enemyCount` (use `stateUpdate.run` or
    `testGameState().run` consistently with other tier deploy tests).

## Verification: code
