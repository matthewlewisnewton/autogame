# 01 — Spherical AoE core helpers

Add a shared 3D distance helper and upgrade the three central radial primitives in `simulation.js` so radius membership uses `Math.hypot(dx, dy, dz)` with each entity's resolved world Y (`getEntityWorldY`). These helpers are the foundation every card, key item, and area effect will call.

## Acceptance Criteria

- `game/server/simulation.js` exposes a pure helper (e.g. `distance3D` or `isWithinSphericalRadius`) that computes 3D distance between an origin `{ x, y, z }` and a target entity using `getEntityWorldY` for the target's Y when `entity.y` is unset.
- `collectRadialHits(originX, originZ, radius, damage, options)` accepts optional `options.originY` (default: `resolveFloorY(sampleFloorY(layout, originX, originZ))` when layout exists, else `0`) and skips enemies whose 3D distance from the origin exceeds `radius`.
- `healPlayersInRadius(originX, originZ, radius, healAmount, options)` uses the same 3D inclusion rule for living, non-extracted players.
- `applyFreezeInRadius(originX, originZ, radius, durationMs, damage, frozenBonusDamage, options)` uses the same 3D inclusion rule for enemies.
- Flat-ground existing tests (`new_card_pack.test.js`, `purifying_pulse.test.js`, etc.) continue to pass without caller changes when all entities share the same Y.
- New unit tests in `game/server/test/spherical_aoe.test.js` prove for each of the three helpers: a target at the same `(x, z)` but within vertical range of the sphere radius **is** affected; a target at the same `(x, z)` but beyond vertical range **is not**; a target outside horizontal range at the same Y **is not** affected.

## Technical Specs

- `game/server/simulation.js`:
  - Add `distance3D(originX, originY, originZ, entity)` (or equivalent) near `getEntityWorldY` / `proximityToSample`.
  - Add `resolveRadialOriginY(originX, originZ, options)` to centralize the default origin-Y fallback.
  - Update `collectRadialHits`, `healPlayersInRadius`, and `applyFreezeInRadius` to compare `distance3D(...) <= radius` instead of `Math.hypot(dx, dz)`.
  - Export the new distance helper alongside existing combat exports.
- `game/server/test/spherical_aoe.test.js` (new): direct unit tests against the three helpers with manually placed players/enemies at different `y` values on the same `(x, z)` grid coordinate.

## Verification: code
