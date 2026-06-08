## Game fixes for harness blockers

Minimal `game/` changes required for a green full playthrough (ticket exception for writable-output scope):

- **`canyon-descent-encounter-trigger`** (`debugScenarios.js`, registered in `index.js`): debug shortcut to activate the dormant Canyon Warden after `canyon-descent-boss-approach`; spawns a nearby grunt for `bossDistinctFromAdds`. Same state is reachable by walking into the encounter trigger in normal play.
- **`canyon-descent-boss-approach` reposition** (`debugScenarios.js`): uses `repositionNearEnemy` toward the live miniboss instead of an encounter-anchor offset so the harness reliably reaches the dormant boss room.
- **`nudgeDebugBossApproachPlayers` trigger** (`debugScenarios.js`): activates the encounter when the nudged player is already within `ENCOUNTER_TRIGGER_RADIUS` (matches normal walk-in activation).
- **`ice-ball-ready` + `debugForceStatusRoll`** (`debugScenarios.js`, `cardEffects.js`): when `ALLOW_DEBUG_SCENARIOS=1`, forces the next Glacial Orb slow roll so `slowBurnMutuallyExclusive` is deterministic (65% proc was flaky under harness).
- **`clearPlayerCardCommitment`** on debug scenario swap (`debugScenarios.js`): clears wind-up/cooldown before card-exercise scenarios to avoid `[cardError] Slot on cooldown` when swapping `ice-ball-ready` → `fireball-hand-ready`.
- **`nearbySpawnPosition` radius clamp** (`simulation.js`): clamps spawner add positions to the requested radius after dungeon-bounds clamping; fixes flaky `add is placed within ~3 units of spawner` in `test:quick`.
- **`alignAttackFacing`** (`main.js`, `renderer.js`): on `DEBUG_SCENARIO_RESULT`, syncs local attack facing and orbit camera to the server rotation after reposition so card-exercise captures face enemies correctly (debug-only handler path).

Harness-side wiring (outside `game/`): `playthrough.mjs` encounter-trigger step, `combat.mjs` godmode idempotency, `telepipe.mjs` magic-stone float tolerance.
