## Runtime health

The captured run is healthy: `metrics.json` exists, reports `"ok": true`, has no `harness_failure`, and `pageerrors` is an empty array. `console.log` contains no `pageerror`, uncaught exception, or `[fatal]` entry from game code; the two 409 resource messages do not stop scene initialization or gameplay probes. Server and client logs show the app started, accepted two players, entered gameplay, and shut down cleanly. The PNG screenshot files referenced in `metrics.json` were not present in `round-1`, so visual image review could not be performed from files, but the structured probes show `sceneInitialized: true`, `hasCanvas: true`, two connected players, live enemies, movement, and the key-item cooldown HUD.

Coverage visibility is also green: `coverage.log` reports `107 passed` test files and `1774 passed` tests, including `server/test/spherical_aoe.test.js` and `server/test/spherical_aoe_cards.test.js`. Thresholds were disabled as expected.

## Acceptance Criteria

### Make all AoE/radius effects 3D spherical instead of flat 2D

Partially satisfied, but not complete. The shared radial helpers in `game/server/simulation.js` now use `distance3D()`/`getEntityWorldY()`, and major helpers such as `collectRadialHits()`, `healPlayersInRadius()`, `applyFreezeInRadius()`, `pullEnemiesToward()`, `applyEventHorizon()`, volatile explosions, inferno pillar ticks, enchantment triggers, and mirror ward fallback are height-aware when called with the right origin.

However, the live production paths still miss several effects. `dragons_breath` uses height-aware aim for the initial cone burst, but `spawnDragonsBreathEffect()` stores only X/Z direction and no `originY`/`dirY`; `updateAreaEffects()` later calls `collectConeHits()` with no vertical options, so the lingering DoT does not preserve the spherical/3D aim required for this enumerated AoE card. `inferno_pillar` has a height-aware area-effect helper, but the real card cast calls `spawnInfernoPillarEffect(originX, originZ, cardDef, socket.playerId)` without passing the already computed caster `originY`, so the lingering DoT can resolve around floor height instead of the caster's world height. Additional gameplay radius filters remain horizontal-only, including `rally_cry`, `flare_beacon`, smoke concealment, enemy field-medic healing, sacrifice target selection, and chain-lightning chain radius in flat-aim cases.

### Symmetric player-card AoE and enemy AoE

Partially satisfied. Enemy attack hit confirmation now uses 3D range in `isEntityInEnemyAttack()`, volatile enemy explosions carry death height from `progression.js`, and minion/enemy breath/projectile paths already have height-aware helpers. The symmetry is not complete because enemy support healing in `healFieldMedicAlly()` still uses only X/Z distance for `healRadius`, and smoke concealment still tests only X/Z while enemy targeting relies on it.

### Verify every AoE/radius card with height tests

Partially satisfied. The new tests cover the named core cards in the ticket: `frost_nova`, `glacier_collapse`, `inferno_pillar`, `purifying_pulse`, `event_horizon`, `gravity_well`, `dragons_breath`, and `field_medic_kit` healing. The tests also cover generic radial helpers, volatile explosions, enchantments, enemy attacks, and mirror ward fallback.

The coverage is not robust enough because the tests bypass or only partially exercise some production call sites. `inferno_pillar` tests pass `{ originY }` directly to `spawnInfernoPillarEffect()`, but the actual card cast does not. `dragons_breath` tests cover the initial burst, not the lingering `areaEffects` ticks. Existing chain-lightning height tests verify primary projectile height awareness, but not the `chainRadius` bounce exclusion when the primary is flat and the chained target is vertically outside the sphere.

## Design and requirements consistency

The direction matches `game/docs/design.md`: combat remains a 3D multiplayer action RPG, and using `sampleFloorY()`/`getEntityWorldY()` is consistent with sloped floor support and future flying enemies. The captured run also preserves the foundation in `game/docs/requirements.md`: Three.js renders, the frontend connects to the backend, multiplayer state is visible, and movement updates are observed.

The remaining gaps are integration completeness issues rather than a design conflict.

## Code quality

The helper direction is good and localized, but the implementation is not yet robust because height-awareness is opt-in at too many call sites. Some production callers compute `originY` correctly and then fail to pass it into lingering effects, while some radius code still uses raw `Math.hypot(dx, dz)` in combat/effect contexts. That makes the behavior easy to regress and means the ticket is not actually "ALL AoE/radius effects" yet.

No new development debug scenario appears to have been added for this ticket, and the capture used no `debugScenario`, so the debug-scenario acceptance checks do not introduce a separate blocker.

## Remaining gaps

1. `dragons_breath` lingering DoT ticks are not height-aware because the spawned area effect drops `originY`/`dirY` and `updateAreaEffects()` calls `collectConeHits()` without vertical options.
2. `inferno_pillar` production casts do not pass the caster's computed `originY` into `spawnInfernoPillarEffect()`, so the lingering sphere can be centered on floor height instead of caster world height.
3. Several remaining gameplay radius effects still use XZ-only distance, including chain-lightning chain radius, sacrifice target radius, key-item aura/reveal/conceal radii, and enemy field-medic healing radius.

VERDICT: FAIL
