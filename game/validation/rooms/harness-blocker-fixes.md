## Game fixes for harness blockers

Minimal `game/` changes required for a green full rooms playthrough (ticket exception for writable-output scope):

- **`training-caverns-encounter-trigger`** (`debugScenarios.js`, registered in `index.js`): debug shortcut to activate the dormant Annex Overseer after `training-caverns-boss-approach`. Same transition is reachable by walking into the encounter trigger in normal play (adds are cleared before activation; no post-activation enemy spawns).
- **`__captureBossVisualIdentityForTest`** (`client/main.js`): harness probe helper comparing dormant/active stage boss vs nearest live add via `__AUTOGAME_HARNESS_STATE__` and `__getEnemyRenderScaleForTest`. Used during mid-combat capture while dormant `annex_overseer` and live adds coexist after `training-caverns-near-adds`.

Harness-side wiring (outside `game/`): rooms `bossVisualIdentity` probe captures during mid-combat (`03-mid-combat.png`) after `training-caverns-near-adds`, via `runStageBossMidCombatProbeStep` in the rooms full revalidate path (`runStageBossRevalidateFullStep`). Rooms preset uses keyboard `activateEncounter` after `training-caverns-boss-approach` (unlike sunken-canyon, which calls `canyon-descent-encounter-trigger` directly in `playthrough.mjs`).
