1. Required Vitest verification is failing: `server/test/debug-scenarios.test.js > debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` gets `arena-trials-boss-approach` result `ok: false`.
   Files: `game/server/debugScenarios.js`, `game/server/encounters.js`, `game/server/index.js`, `game/server/test/debug-scenarios.test.js`.
   Fix: Preserve/fix the existing Arena Trials boss-approach debug scenario while keeping the ROOMS shortcuts; rerun the server/client harness checks until `coverage.log` has zero failed tests.
