# Review: 296-fire-enemy-inflicts-burning

## Runtime health

PASS. The captured run started and loaded cleanly. `metrics.json` reports `"ok": true`, reaches live gameplay with canvas and connected clients, and has an empty `pageerrors` array. `pageerrors.json` is empty. `console.log` contains no `pageerror` or `[fatal]` lines from game code; the only notable line is a non-fatal 409 resource response during auth/lobby setup.

## Fire enemy spawns in the fire level

PASS. `ember_wraith` is defined as a normal enemy type and is included in the `ember_descent` tier-1 enemy pool with weighted spawning. `spawnCombatEnemies()` draws from `getEnemyPool(quest.id, quest.tier)`, so normal Ember Descent deployment can spawn it. Cross-level exclusion is covered by tests that verify non-ember quests do not include or spawn `ember_wraith`.

The fire-cavern debug scenario remains a QA shortcut into the normal `ember_descent` tier-1 state: it sets the same quest/tier and layout that normal selection/deploy uses, and tests verify the resulting run, objective, layout profile, spawn position, and allowed enemy pool. The added `ember-wraith` shortcut is gated through the existing debug-scenario path and only places a normal `spawnEnemy(..., 'ember_wraith')` instance for targeted QA; the same end state is reachable through Ember Descent enemy spawning.

## Attack applies burning to the player

PASS. The enemy definition includes `burnDurationMs`, and the live enemy windup resolution calls `applyBurning(target, enemy.burnDurationMs)` only after a validated player-directed hit has also called `damagePlayer`. This preserves the existing attack invariants: missed cones, out-of-range targets, smoke-concealed players, and minion-target hits do not apply player burning.

Server tests cover successful ignition, cone miss, out-of-range cancel, smoke concealment, non-burning grunt hits, and burn tick damage over multiple intervals with expiry. The shared `applyBurning`/`updateBurning` path supplies the per-tick plus extra fire damage behavior, and the existing renderer flame marker uses `burningUntil` for player and enemy burning visuals.

## Lock-on panel and enemy display metadata

PASS. `ENEMY_DEFS.ember_wraith` includes name, description, surfaced stats, combat stats, cone attack style, and burn duration metadata. The enemy display catalog trims and publishes the surfaced values, while the client lock-on panel labels and formats `burnDurationMs` as seconds. Client tests verify the Ember Wraith panel model includes name, description, HP, attack, cone style, chase speed, and burn duration.

## Client render and attack telegraph

PASS. The client registers `ember_wraith` as a procedural warm emissive octahedron with a distinct footprint, model registry entry, and cone telegraph matching the server's `Math.PI / 3` attack cone. Renderer and main tests cover mesh creation, height/footprint normalization, visual distinction from grunt, and registry handling.

## Design and requirements consistency

PASS. The change fits the documented action-RPG dungeon loop: a level-exclusive enemy in the fire-cavern quest adds combat pressure without altering lobby flow, multiplayer state, movement, or rendering foundations. The captured smoke run verifies the baseline requirements still hold: Three.js scene initializes, clients connect over WebSockets, multiplayer presence exists, and movement/dodge state updates during gameplay.

## Test and coverage evidence

PASS. The provided coverage run reports 116 test files and 1895 tests passed. Relevant coverage includes `server/test/ember_wraith_burning.test.js`, `server/test/enemy-spawn-pools-wiring.test.js`, `server/test/quests-spawn-pools.test.js`, `server/test/enemy_display_catalog.test.js`, `client/test/lock-on-info-panel.test.js`, `client/test/main.test.js`, and `client/test/renderer-registry-normalize.test.js`.

## Remaining gaps

None.

VERDICT: PASS
