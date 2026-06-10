# 06-key-item-radii-spherical

Key item effect radii in `keyItemEffects.js` still use flat XZ `Math.hypot(dx, dz)` checks, so elevated targets/loot that are XZ-inside but outside the intended sphere are still healed, buffed, revealed, or pulled. Convert `field_medic_kit`, `rally_cry`, `flare_beacon`, and `loot_magnet` radius checks to true 3D spherical distance using the shared helpers already exported from `simulation.js`.

## Acceptance Criteria

- `field_medic_kit` heal radius uses 3D spherical distance from the caster's resolved world Y (`getEntityWorldY(player)`): an ally on elevated ground who is inside the sphere (3D distance ≤ `healRadius`) is healed; an ally XZ-inside but with enough height difference that 3D distance > `healRadius` is NOT healed.
- `rally_cry` buff radius uses 3D spherical distance the same way: elevated in-sphere allies get `rallyUntil`/`rallySpeedMultiplier`; XZ-inside/out-of-sphere allies do not.
- `flare_beacon` reveal radius uses 3D spherical distance: an elevated enemy inside the sphere gets `revealedUntil` set; an XZ-inside/out-of-sphere enemy does not.
- `loot_magnet` attraction gate uses 3D spherical distance to each loot drop (loot Y resolved via `getEntityWorldY`, falling back to floor sampling when the drop has no `y`): in-sphere loot is pulled, XZ-inside/out-of-sphere loot is left untouched. The pull displacement itself stays on the XZ plane (loot slides along the floor).
- New/updated tests cover, for each of the four key items: (a) an elevated target inside the sphere IS affected, and (b) an XZ-inside but out-of-sphere target is NOT affected.
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/server/keyItemEffects.js`:
  - Extend the existing `require('./simulation')` import (which already pulls `getEntityWorldY`) to also import `sphericalDistanceToEntity`.
  - `field_medic_kit` (~line 113): replace `Math.hypot(p.x - casterX, p.z - casterZ)` with `sphericalDistanceToEntity(casterX, casterY, casterZ, p)` where `casterY = getEntityWorldY(player)` captured next to `casterX`/`casterZ`.
  - `rally_cry` (~line 236): same conversion for the ally loop, origin = caster position + `getEntityWorldY(player)`.
  - `flare_beacon` (~line 279): same conversion for the enemy loop.
  - `loot_magnet` (~line 304): replace the `dist > attractRadius` gate with a 3D check via `sphericalDistanceToEntity(player.x, playerY, player.z, loot)`. Keep the XZ direction/`tryPlayerMove` displacement logic unchanged; for the post-pull auto-collect check (~line 327), keep or convert to 3D — either is acceptable as long as elevated out-of-sphere loot is never gated in by the initial 2D check.
- `game/server/test/field_medic_kit.test.js`, `game/server/test/key-items.test.js`, `game/server/test/loot_magnet.test.js`: add cases placing targets/loot at different `y` values (directly or via room `floorCorners`) proving elevated in-sphere inclusion and XZ-inside/out-of-sphere exclusion for each of the four items.
- Follow the pattern already used by passed sub-tickets (e.g. `barrier_dome`/`smoke_bomb` in the same file store `getEntityWorldY(player)` at cast time).

## Verification: code
