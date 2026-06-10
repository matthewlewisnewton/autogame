1. `boss-level-dormant` debug scenario reaches a fixture-only quest, not a normal gameplay state.
   Files: game/server/debugScenarios.js, game/server/quests.js
   Fix: remove this URL scenario or retarget it to a registered live boss-level quest; fixture-only boss-level coverage should stay in tests.

2. Dormant encounter bosses can be damaged/killed before activation, which can softlock stage-boss victory.
   Files: game/server/simulation.js, game/server/encounters.js, game/server/progression.js
   Fix: make all enemy damage paths ignore or prevent damage to `run.encounter.bossEnemyId` while the encounter is dormant, or explicitly handle dormant boss death as a valid activation/clear path; add tests for direct, AoE, burn/trap, and minion damage.
