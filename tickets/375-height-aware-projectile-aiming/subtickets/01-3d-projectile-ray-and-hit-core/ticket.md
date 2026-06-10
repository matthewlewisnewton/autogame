# 01 — 3D projectile ray and hit-detection core

Add shared server helpers that resolve entity world Y, compute a normalized 3D aim vector, and test projectile proximity in 3D. Upgrade the simulation hit collectors (`collectProjectileHits`, `collectReturningProjectileHits`, `collectChainLightningHits`, `collectPhaseBeamHits`, and `collectConeHits`) to sample along a tilted ray when a vertical aim component is present, while preserving today's flat-XZ behavior when `dirY` is zero or omitted.

## Acceptance Criteria

- `game/server/simulation.js` exports helpers to (a) resolve an entity's attack height (`getEntityWorldY` or equivalent — use `entity.y` when set, otherwise `resolveFloorY(sampleFloorY(layout, x, z))`), and (b) build a normalized `{ dirX, dirY, dirZ }` from shooter position to target position.
- `collectProjectileHits` accepts optional `originY` and `dirY` (or a single 3D direction object) and, when `dirY` is non-zero, samples `(originX + dirX*t, originY + dirY*t, originZ + dirZ*t)` and registers a hit when 3D distance to the target's world position is within `hitWidth` (XZ-only path unchanged when flat).
- `collectReturningProjectileHits`, `collectChainLightningHits`, and `collectPhaseBeamHits` use the same 3D ray sampling and 3D proximity checks.
- `collectConeHits` supports a tilted cone axis: when `dirY` is provided, cone membership uses the 3D angle between the aim vector and the vector to each target (not just XZ dot product).
- Existing flat-ground tests (`fireball_card.test.js`, `chain_lightning.test.js`, `new_card_pack.test.js`, etc.) continue to pass without changes to their call sites.
- New unit tests in `game/server/test/height_aware_projectiles.test.js` (or `simulation.test.js`) prove: a target directly above the shooter on the same `(x, z)` is **missed** with flat XZ aim but **hit** with a +Y aim vector; a target at the same elevation still hits with both modes.

## Technical Specs

- `game/server/simulation.js`:
  - Add `getEntityWorldY(entity)` and `computeAimDirection3D(from, to)` (or similarly named pure helpers near the other combat utilities).
  - Extend `collectProjectileHits`, `collectReturningProjectileHits`, `collectChainLightningHits`, `collectPhaseBeamHits`, and `collectConeHits` signatures with optional `originY` / `dirY` (default `0`). Sample along the full 3D direction; compare hits using `Math.hypot(dx, dy, dz)` against each target's resolved world Y.
  - Export the new helpers alongside existing combat exports in `module.exports`.
- `game/server/test/height_aware_projectiles.test.js` (new): direct unit tests against the collectors with manually placed enemies at different `y` values on the same `(x, z)` grid coordinate.

## Verification: code
