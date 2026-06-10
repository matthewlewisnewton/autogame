## Game fixes for harness blockers

Minimal `game/` changes required for a green full rooms playthrough (ticket exception for writable-output scope):

- **`training-caverns-encounter-trigger`** (`debugScenarios.js`, registered in `index.js`): debug shortcut to activate the dormant Annex Overseer after `training-caverns-boss-approach`; spawns a nearby grunt for `bossDistinctFromAdds`. Same state is reachable by walking into the encounter trigger in normal play.
- **`spawnHarnessBossVisualAddIfNeeded`** (`debugScenarios.js`, hooked from `encounters.js` via `index.js`): when `ALLOW_DEBUG_SCENARIOS=1` and a boss-approach debug scenario is active, spawns a 1-HP grunt beside the annex_overseer after encounter activation so the harness `bossVisualIdentity` probe can compare render scales (adds are cleared on activation in normal play). Replaces an earlier `encounters.js` direct `require('./progression')` spawn that intermittently threw `spawnEnemy is not a function` due to circular module loading.

Harness-side wiring (outside `game/`): rooms preset uses keyboard `activateEncounter` after `training-caverns-boss-approach` (unlike sunken-canyon, which calls `canyon-descent-encounter-trigger` directly in `playthrough.mjs`).
