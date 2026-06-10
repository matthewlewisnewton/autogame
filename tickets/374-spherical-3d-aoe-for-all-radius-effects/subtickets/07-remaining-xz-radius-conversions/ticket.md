# 07 — Convert remaining XZ-only gameplay radius checks to 3D

Several combat and key-item radius filters still use `Math.hypot(dx, dz)`, leaving player/enemy symmetry incomplete and violating the ticket's "ALL AoE/radius effects" scope. Convert each listed path to 3D spherical distance via `distance3D` / `getEntityWorldY`, and add focused height tests.

## Acceptance Criteria

- **`rally_cry`** (`keyItemEffects.js`): party buff radius uses 3D distance from `(player.x, getEntityWorldY(player), player.z)` to each ally.
- **`flare_beacon`** (`keyItemEffects.js`): enemy reveal radius uses 3D distance from caster world Y to each enemy's world Y.
- **`smoke_bomb` concealment** (`keyItemEffects.js` + `simulation.js`): smoke zone stores caster `smokeBombY` at cast time; `isPlayerConcealed()` tests 3D distance from `(smokeBombX, smokeBombY, smokeBombZ)` to the concealed player.
- **`healFieldMedicAlly()`** (`simulation.js`): enemy medic heal radius uses 3D distance between medic and ally world Y positions.
- **`findSacrificeTarget()`** (`index.js`): minion sacrifice selection uses 3D distance from `(x, originY, z)` (resolve origin Y from floor or passed caster height) instead of XZ-only.
- **`collectChainLightningHits()` chain bounce** (`simulation.js`): chain-radius neighbor search always uses 3D distance (including `dy`), even when the primary ray uses flat aim (`dirY === 0`), so vertically out-of-sphere targets are excluded.
- `game/server/test/spherical_aoe.test.js` and/or `game/server/test/spherical_aoe_cards.test.js` (and extend existing `smoke_bomb.test.js`, `chain_lightning.test.js`, `field_medic.test.js`, `key-items.test.js` as needed) each include at least one in-sphere and one out-of-sphere height case for every converted path above.
- Flat-ground existing tests for these features continue to pass.

## Technical Specs

- `game/server/keyItemEffects.js`:
  - `rally_cry`: replace `Math.hypot(p.x - player.x, p.z - player.z)` with 3D distance using `getEntityWorldY`.
  - `flare_beacon`: same pattern for enemy reveal loop.
  - `smoke_bomb`: set `player.smokeBombY = getEntityWorldY(player)` alongside `smokeBombX`/`smokeBombZ`.
- `game/server/simulation.js`:
  - `isPlayerConcealed()`: use `distance3D(owner.smokeBombX, owner.smokeBombY ?? resolveRadialOriginY(...), owner.smokeBombZ, player)`.
  - `healFieldMedicAlly()`: replace ally distance check with `distance3D(medic.x, getEntityWorldY(medic), medic.z, ally)`.
  - `collectChainLightningHits()`: in the chain-bounce loop, always compute `Math.hypot(dx, dy, dz)` (or call `distance3D`) regardless of `use3D` for the primary ray.
- `game/server/index.js`:
  - `findSacrificeTarget(playerId, x, z, radius)`: compare `distance3D(x, resolveRadialOriginY(x, z, {}), z, minion) <= radius` (or thread an optional `originY` from the sacrifice card cast if available).
- Tests (add/extend as appropriate):
  - `game/server/test/spherical_aoe.test.js` — medic heal + chain-lightning chain-radius height cases.
  - `game/server/test/smoke_bomb.test.js` — elevated in-zone concealed / out-of-zone targetable.
  - `game/server/test/key-items.test.js` or `spherical_aoe_cards.test.js` — `rally_cry` and `flare_beacon` height cases.
  - Sacrifice radius height case (e.g. in `integration.test.js` or `spherical_aoe_cards.test.js`).

## Verification: code
