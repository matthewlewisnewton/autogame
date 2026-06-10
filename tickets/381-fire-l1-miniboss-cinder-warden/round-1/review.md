# Senior Review: 381-fire-l1-miniboss-cinder-warden

## Runtime health

The captured game run starts and loads cleanly. `metrics.json` reports `ok: true`, no harness failure, and an empty `pageerrors` array. `console.log` contains normal Vite connection and scene initialization logs only, with no `pageerror` or `[fatal]` lines from game code. `client.log` only shows the allowed THREE.Clock deprecation warning and Vite `EPIPE` socket-close noise.

The capture used the fallback smoke plan rather than a Cinder Warden-specific visual scenario, but it does prove the ticketed working tree still starts, connects, enters gameplay, renders canvas, synchronizes two players, accepts movement, and exercises the key-item HUD without browser errors.

## Acceptance criteria findings

### Cinder Warden server enemy type

PASS. `game/server/simulation.js` registers `cinder_warden` as `Cinder Warden` with fire-themed description, surfaced stats, 360 HP, cone attack style, `(2 * Math.PI) / 3` cone, 5.5 range, and level-1 stage-boss tuning between `miniboss` and the 420 HP high-tier wardens. `game/server/config.js` maps it to `dungeon_drake` and 52 magic stones, and `game/server/progression.js` includes it in the same party-size HP scaling branch as the other stage bosses.

The enemy display catalog path is covered by `game/server/test/enemy_display_catalog.test.js`, which now includes `cinder_warden` in the expected type list and verifies display metadata is sent through the socket init payload.

### Ember Descent stage-boss encounter wiring

PASS. `game/server/quests.js` defines `ember_descent` Tier II as a `stage_boss` quest on the `fire-cavern` rigid layout with `unlockRequires: { questId: 'ember_descent', tier: 1 }`, signature/reward fire cards, fire-themed client briefing, run-start dialogue, mid-run support progress dialogue, and objective-complete dialogue. Its encounter block uses `bossType: 'cinder_warden'` and `addCount: 4`, without inventing a fire-cavern landmark that the layout may not place.

The stage-boss objective summary resolves through the new `defeatCinderWarden` and `defeatCinderWardenWithSupports` strings in `game/shared/theme.json`. `game/server/test/ember_descent_stage_boss.test.js` verifies the config, exact one-boss-plus-four-adds spawn shape, boss ID wiring, dormant encounter state at run open, and boss defeat clearing the encounter and completing the objective.

### Client render, telegraph, and metadata panel

PASS. `game/client/renderer.js` adds a boss-scale fire-toned `ENEMY_GEOMETRY.cinder_warden` and an `ENEMY_ATTACK_VISUAL.cinder_warden` cone telegraph matching the server cone angle and 5.5 range. `game/client/models.js` maps `cinder_warden` to `null`, matching the procedural-rendered warden pattern. `game/client/test/renderer-cinder-warden.test.js` covers the geometry, telegraph, and registry behavior.

The lock-on metadata panel and boss HUD remain generic and server-catalog driven, so the new surfaced metadata reaches the panel without bespoke client panel code. This is consistent with the existing design and does not regress the generic enemy-catalog contract.

### Debug scenario review

PASS. The new `ember-descent-tier-2` debug scenario is registered only in the normal debug-scenario path and is requested by the client exclusively from the localhost `?debugScenario=` URL parameter. The equivalent state is reachable through normal gameplay by clearing Ember Descent Tier I, unlocking Tier II, selecting Ember Descent Tier II, and deploying.

The shortcut does not replace the encounter implementation with a fake state: it sets the quest/tier and layout, then uses the same `enterPlayingPhase`, `spawnEnemies()`, and `startDungeonRun()` flow that regular deployment uses. It unlocks the tier for the debug account so the QA shortcut can select the state, but the quest definition still preserves the normal `unlockRequires` gate.

### Design and foundation consistency

PASS. The implementation follows the existing stage-boss framework described in `game/docs/design.md`: one stage-boss encounter, server-authored enemy metadata, defeat objective, supporting adds, and generic lock-on panel data. It does not weaken the base setup requirements in `game/docs/requirements.md`; the captured run confirms rendering, client-server connection, multiplayer representation, and synchronized movement still work.

## Verification

The provided coverage log shows the full vitest coverage run passed: `188` test files and `2652` tests passed. New relevant coverage includes `server/test/cinder_warden.test.js`, `server/test/ember_descent_stage_boss.test.js`, `server/test/enemy_display_catalog.test.js`, and `client/test/renderer-cinder-warden.test.js`.

## Remaining gaps

None.

VERDICT: PASS
