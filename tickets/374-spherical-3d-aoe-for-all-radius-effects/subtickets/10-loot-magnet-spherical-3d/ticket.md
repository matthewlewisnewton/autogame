# 10 — Loot magnet spherical 3D radius

`loot_magnet` still uses XZ-only distance for `attractRadius` filtering and the final auto-collect check, so loot at the same horizontal position but a different height can be pulled and collected incorrectly. Convert both radii to 3D spherical distance with consistent loot world Y.

## Acceptance Criteria

- Attract filtering uses 3D distance from `(player.x, getEntityWorldY(player), player.z)` to each loot item's world Y.
- Final pickup-radius check after the pull also uses 3D distance (not XZ-only `Math.hypot`).
- Loot world Y resolves as `loot.y` when finite, otherwise floor-derived Y via `resolveRadialOriginY(loot.x, loot.z, {})` (same pattern as `getEntityWorldY` for entities without explicit `y`).
- Production loot drops set `y` at spawn time where missing (enemy currency/magic-stone drops and `spawnLoot`) so runtime Y matches floor height on slopes.
- Loot at the same `(x, z)` within vertical attract range is pulled and collected; loot at the same `(x, z)` beyond vertical attract range is untouched.
- Existing flat-ground `game/server/test/loot_magnet.test.js` cases continue to pass.
- New vertical in-sphere / out-of-sphere cases are added to `game/server/test/loot_magnet.test.js`.

## Technical Specs

- `game/server/keyItemEffects.js` — in the `loot_magnet` branch (~line 293):
  - Add a small local helper or inline: `getLootWorldY(loot) => Number.isFinite(loot.y) ? loot.y : resolveRadialOriginY(loot.x, loot.z, {})`.
  - Replace attract `Math.hypot(loot.x - player.x, loot.z - player.z)` with `Math.hypot(dx, dy, dz)` using player and loot world Y.
  - Replace final `finalDist` XZ check with the same 3D distance against `LOOT_PICKUP_RADIUS`.
  - Import `resolveRadialOriginY` from `simulation.js` if not already available in this module.
- `game/server/progression.js` — when pushing loot in `spawnMagicStoneDrop`, `spawnCurrencyDrop`, and `spawnLoot`, set `y: resolveFloorY(sampleFloorY(layout, x, z))` (or equivalent using existing floor helpers) when layout is available.
- `game/server/test/loot_magnet.test.js` — add cases with explicit `loot.y` and player `y` offsets:
  - same XZ, small `dy` within attractRadius → pulled/collected;
  - same XZ, large `dy` outside attractRadius → loot unchanged after cast.

## Verification: code
