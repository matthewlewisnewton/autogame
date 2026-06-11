1. Vitest coverage run fails two server debug-scenario tests: `training-caverns-boss-low-hp` emits `annex_overseer` at 320 HP, and `spire-ascent-boss-low-hp` emits `spire_warden` at 420 HP, while both tests expect the state update boss HP to be 1.
   Files: `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`
   Fix: Ensure the low-HP boss debug scenarios pin the authoritative boss HP to 1 before emitting `stateUpdate`, or update stale tests only if the intended scenario contract changed.
