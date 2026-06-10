# Review — 375-height-aware-projectile-aiming

## Runtime health

PASS. The captured game run is valid: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `pageerrors.json` is empty, and `console.log` contains no `pageerror` or `[fatal]` lines from game code. The only runtime noise in the logs is benign capture/browser noise such as Vite socket close output and duplicate-resource 409s during auth setup.

The fallback capture reached normal multiplayer gameplay, reported a live canvas, connected state, two players, active dungeon phase, enemy state, hand HUD, movement probes, and key-item cooldown probes. The screenshot filenames listed in `metrics.json` were not present as PNG files in `round-1`, so this review relies on the runtime probes/logs plus the already-completed visual QA for screenshots.

## Per-criterion findings

### Height-aware 3D projectile core

PASS. `game/server/simulation.js` now resolves entity world Y, computes normalized 3D aim vectors, and threads `originY`/`dirY` through projectile, returning projectile, chain-lightning, phase-beam, and cone collectors. The collectors preserve same-elevation behavior while making vertical mismatch meaningful when flat aim is used and true 3D proximity/angle checks available when a vertical component is supplied.

### Player lock-on projectile cards

PASS. `game/client/main.js` includes the active lock target id in both normal and test `useCard` emits. Server-side `resolveProjectileAim` ignores client rotation when `lockTargetId` resolves to a live enemy and uses the shooter and target full world positions. `game/server/cardEffects.js` applies that shared aim path to weapon projectiles, returning photon projectiles, `fireball`, `ice_ball`, `chain_lightning`, and `dragons_breath`, and emits `direction.y` when the aim is tilted.

The new `height_aware_projectiles.test.js` enumerates the named player projectile cards: `fireball`, `arcane_bolt`, `photon_slicer`, `infinite_disk`, `ice_ball`, `chain_lightning`, and `dragons_breath`. Each verifies an elevated same-XZ target misses without lock-on/3D aim and is hit with lock-on height aim. `excalibur_photon` is explicitly documented as out of scope because it is a cone weapon rather than a traveling projectile.

### Enemy and minion symmetry

PASS. Enemy ice-ball windups now store vertical direction, spawned ice balls carry `y`/`dirY`, move through 3D space, and collide against player world Y. Minion windups and breath locks also compute full 3D direction; `storm_eagle`/`thunderbird` use the same ranged-strike branch, `null_crawler` passes vertical aim into phase-beam collection, and `dungeon_drake`/`ancient_wyrm` breath ticks pass vertical aim into cone collection.

The test matrix covers glacial thrower ice balls, `storm_eagle`, `null_crawler`, `dungeon_drake`, and `ancient_wyrm` against elevated targets.

### Debug scenarios

PASS. The added `lock-on-elevated-projectile` and `height-aware-projectile` scenarios are registered through the existing debug-scenario path, with the player-facing shortcut remaining the localhost `?debugScenario=` URL and the server path gated by development/local checks. Both are QA shortcuts for states reachable through normal play: earning/drawing a projectile card, entering vertical dungeon geometry such as Spire Ascent, and fighting enemies on higher elevation. They do not replace server validation, persistence, or normal combat resolution; they only seed player/enemy positions, hand contents, layout, and cooldowns before using the same `useCard` and simulation paths.

### Design and foundation compatibility

PASS. The implementation matches the design document's 3D dungeon/elevation model by using server-resolved floor/sample Y where explicit entity Y is absent. The captured run still satisfies the foundation requirements: Three.js scene renders, client/server socket connectivity works, multiplayer state is visible, and movement synchronization remains active.

### Code quality and validation

PASS. The implementation is localized to the expected combat/server paths plus a focused test file. The full captured coverage run reports `111` test files and `1952` tests passing. No dead or obviously broken code was found in the reviewed paths.

## Remaining gaps

None.

VERDICT: PASS
