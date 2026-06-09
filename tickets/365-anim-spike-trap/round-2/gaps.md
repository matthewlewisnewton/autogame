1. Vitest coverage fails in `canyon-descent-boss-low-hp`: the emitted `stateUpdate` reports the miniboss at 300 HP instead of 1 HP after the low-HP debug scenario.
   Files: `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`
   Fix: Ensure the low-HP canyon boss scenario mutates the active encounter boss before emitting/capturing `stateUpdate`, or adjust the scenario flow so the test receives the post-mutation snapshot.
