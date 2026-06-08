1. Vitest coverage run fails in `server/test/debug-scenarios.test.js`: `arena-trials-boss-approach` returns `ok: false` where the test expects `true`.
   Files: `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`
   Fix: Reproduce that test, inspect the returned `reason`, and make `arena-trials-boss-approach` accept the cleared-adds dormant arena state or update the test if the scenario contract changed intentionally.
