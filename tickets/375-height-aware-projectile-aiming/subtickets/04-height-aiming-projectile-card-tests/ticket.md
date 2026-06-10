# 04 — Height-aiming coverage for every projectile card

Add debug scenarios and a consolidated test matrix that enumerates every projectile card named in ticket 375, each with an explicit height-offset hit case. This sub-ticket is the acceptance gate for full ticket coverage — no projectile card may be left without a height-aiming regression test.

## Acceptance Criteria

- `game/server/test/height_aware_projectiles.test.js` contains one `describe` block per projectile card below, each with at least one test where shooter and target share `(x, z)` but differ in `y`, and lock-on / 3D aim produces a hit:
  - **Weapons:** `fireball`, `arcane_bolt`, `photon_slicer`, `infinite_disk`
  - **Spells:** `ice_ball`, `chain_lightning`, `dragons_breath`
  - **Minion attacks (via simulation):** `storm_eagle`, `null_crawler` (phase beam), `dungeon_drake` / `ancient_wyrm` (breath cone)
  - **Enemy projectile:** glacial thrower ice ball (`attackStyle: 'ice_ball'`)
- `excalibur_photon` is explicitly documented in a test comment as out of scope (cone weapon, not a traveling projectile) unless a height-aim case is added voluntarily.
- At least one debug scenario in `game/server/debugScenarios.js` places the player on a lower elevation band and an enemy on a higher band (sloped floor layout) so integration tests can exercise real `sampleFloorY` Y values rather than only manual `enemy.y` overrides.
- `pnpm test` passes with the full server + client suites.

## Technical Specs

- `game/server/test/height_aware_projectiles.test.js`:
  - Finalize the enumeration matrix; reuse helpers from `test/helpers.js` and patterns from `fireball_card.test.js`, `ice_ball_card.test.js`, `chain_lightning.test.js`, `new_card_pack.test.js`, `ice_enemy.test.js`, `ancient_wyrm.test.js`.
  - Shared setup helper: spawn shooter + target at same `(x, z)`, set unequal `y` (via floor layout or explicit `y`), fire with `lockTargetId` / minion wind-up / enemy ice ball as appropriate, assert damage or `hits.length > 0`.
- `game/server/debugScenarios.js`:
  - Add scenario (e.g. `height-aware-projectile`) with sloped `floorCorners` or ramp room from an existing quest layout; player below, enemy above, hand contains a projectile card for harness use.
- No further production logic changes unless tests reveal a missed card path — in that case, patch only the affected handler in `cardEffects.js` or `simulation.js` and extend the matrix.

## Verification: code
