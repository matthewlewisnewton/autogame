# Review: 374-spherical-3d-aoe-for-all-radius-effects

## Runtime health

PASS. The round-2 capture proves the game starts and loads cleanly: `metrics.json` has `"ok": true`, servers reached gameplay on `http://localhost:5174/`, `pageerrors` is empty, and `console.log` contains only normal Vite connection/init messages. `client.log` contains a Three.js deprecation warning and Vite `EPIPE` socket-close noise, both explicitly benign for this review.

The capture probes reached a two-player run in `playing` phase with scene/canvas initialized, connected socket state, visible card hand, enemies spawned, and movement/dodge probes completing. No browser page error or fatal game-code error was present.

## Acceptance criteria findings

### All AoE/radius effects are 3D spherical

FAIL. The main card/server helpers were substantially converted: `distance3D`, `collectRadialHits`, `healPlayersInRadius`, `applyFreezeInRadius`, `pullEnemiesToward`, `applyEventHorizon`, radial enemy attacks, field-medic healing, enchantment triggers, inferno pillar, dragon breath lingering ticks, volatile explosions, smoke bomb concealment, flare beacon, rally cry, field medic kit, and sacrificial altar now include Y in their inclusion checks.

However, the implementation is not holistic enough for "ALL AoE/radius effects." `barrier_dome` still casts without storing `barrierDomeY`, and `damagePlayer()` still decides whether victims and attackers are inside the dome with `Math.hypot(dx, dz)` only. An elevated attacker or victim at the same XZ can be treated as inside the dome even when outside the spherical radius.

`phase_step` also still uses XZ-only distance for nearest-ally selection and its range gate. An ally directly above or below the caster can be swapped even when outside the key item's intended spherical range.

`loot_magnet` still uses XZ-only distance for both `attractRadius` and the final auto-collect radius. Elevated loot at the same XZ would be pulled and collected despite being outside a sphere.

### Symmetric player and enemy AoE

PARTIAL. Enemy radial attacks and enemy support healing were updated to use 3D distance, and the enumerated player AoE cards have targeted height tests. This satisfies the core player-card/enemy-AoE symmetry for the listed combat cards, but the remaining key-item radius effects above are still flat and violate the top-level "all radius effects" requirement.

### Enumerated AoE cards and tests

PARTIAL. `server/test/spherical_aoe.test.js` and `server/test/spherical_aoe_cards.test.js` enumerate the requested combat effects: `frost_nova`, `glacier_collapse`, `inferno_pillar`, `purifying_pulse`, `event_horizon`, `gravity_well`, `dragons_breath`, healing radius helpers, plus related radial helpers and enemy AoE. The recorded coverage run shows those new spherical suites passed.

FAIL overall because the same coverage run did not pass: `server/test/smoke_bomb.test.js` failed in `casting sets smokeBombUntil/radius/center and cooldown on the caster`, with `persistenceDirtyOnCast` expected `true` but observed `false`. Coverage thresholds are disabled, but a failing functional test is still a blocking validation failure.

### Design and foundation consistency

PARTIAL. The approach is consistent with the design doc's 3D dungeon and floor-height model where implemented: helpers use explicit entity Y when present and floor sampling otherwise. The captured run does not regress the foundational requirements for 3D rendering, client/server connection, multiplayer visualization, or movement sync.

The remaining flat radius checks are the inconsistency: they leave some server-authoritative effects as cylinders on XZ instead of spheres, which conflicts with the ticket's prep for elevated/flying entities.

### Debug scenarios

PASS. This ticket did not add a new `?debugScenario=...` URL shortcut or change `game/server/debugScenarios.js`; `metrics.json` reports no captured scenarios. Existing debug scenario references in the touched files remain gated behind the debug scenario state and are not normal gameplay entry points.

## Remaining gaps

1. `barrier_dome` is still an XZ cylinder instead of a sphere: cast state lacks `barrierDomeY`, and ranged/projectile blocking uses XZ-only victim/attacker distances in `damagePlayer()`.

2. `phase_step` still uses XZ-only range checks for nearest-ally selection and target validation, so vertically out-of-sphere allies can be swapped.

3. `loot_magnet` still uses XZ-only distance for attract and auto-collect radii, so vertically out-of-sphere loot can be pulled/collected.

4. The recorded vitest coverage run failed one functional test: `server/test/smoke_bomb.test.js > casting sets smokeBombUntil/radius/center and cooldown on the caster` observed `persistenceDirtyOnCast === false`.

VERDICT: FAIL
