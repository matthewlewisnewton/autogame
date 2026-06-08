1. Overall Vitest validation is failing: `server/test/debug-scenarios.test.js > debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` gets `approachResult.ok === false`.
   Files: `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`, `game/server/encounters.js`
   Fix: make `arena-trials-boss-approach` accept the post-adds-cleared dormant Arena Trials state used by the test, or adjust the test/setup so add clearing and the scenario's live-add check use the same source of truth.
