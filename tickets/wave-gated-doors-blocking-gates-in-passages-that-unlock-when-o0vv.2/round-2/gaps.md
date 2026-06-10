1. Round-2 captured run failed: `metrics.json` has `"ok": false` because telepipe preservation compared `objective.totalEnemies` (6 authored scripted enemies) to the current active enemy count (2).
   Files: game/server/progression.js, game/server/objectives.js, game/server/scriptedEncounters.js, game/client/main.js
   Fix: Make the scripted-gated telepipe capture/probe contract consistent: preserve full objective totals, but expose/compare the active live enemy count separately so suspend/resume validation passes for multi-wave gated quests.

2. Server-authoritative player movement through an unlocked passage is not green: `server/test/passage_locks.test.js > rejects server movement through a locked passage` fails with `expected 13.200000000000003 to be less than 10`.
   Files: game/server/simulation.js, game/server/scriptedEncounters.js, game/server/test/passage_locks.test.js
   Fix: Fix the authoritative movement/collider path after a passage lock unlocks, or correct the fixture if it drives movement in the wrong direction; the test must prove players are blocked while locked and can advance through the same passage after unlock.

3. A changed debug-scenario module has a red regression: `server/test/debug-scenarios.test.js > arena-trials harness combat shortcuts > places player outside dormant arena_champion trigger after adds cleared` returns `approachResult.ok === false`.
   Files: game/server/debugScenarios.js, game/server/test/debug-scenarios.test.js
   Fix: Restore `arena-trials-boss-approach` so it accepts a valid arena_trials Tier 2 run after adds are cleared and positions the player outside the dormant boss trigger without weakening the normal boss-approach path.
