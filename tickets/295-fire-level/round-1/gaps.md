1. `fire-cavern` debug deploy starts a default run before switching to Ember Descent, so `state.run.questId`/quest name/reward/objective can remain `training_caverns` while the layout and enemies are fire-cavern.
   Files: `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`
   Fix: set `state.selectedQuestId = 'ember_descent'` and apply the fire layout before `enterPlayingPhase`, or rebuild with `startDungeonRun()` after switching; add test assertions for run quest id/tier/name/objective and enemy count.
