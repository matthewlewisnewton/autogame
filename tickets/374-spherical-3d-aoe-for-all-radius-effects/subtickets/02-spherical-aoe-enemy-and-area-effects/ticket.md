# 02 — Spherical AoE for enemy attacks and lingering area effects

Extend spherical radius checks to every remaining server-side radial site outside the three core helpers: enemy radial strikes, pull/crush spells, on-death explosions, enchantment triggers, and mirror-ward fallback blasts. Depends on sub-ticket 01.

## Acceptance Criteria

- `pullEnemiesToward(originX, originZ, radius, strength, options)` includes only enemies within the 3D sphere (using `options.originY` with the same default as sub-ticket 01); pull displacement remains on the XZ plane.
- `applyEventHorizon(originX, originZ, cardDef, attackerId, options)` passes `originY` through to both `pullEnemiesToward` and `collectRadialHits` for center crush damage.
- `isEntityInEnemyAttack(enemy, target)` uses 3D distance (`Math.hypot` including `dy` from `getEntityWorldY`) for range checks; cone attacks still apply the existing cone-angle test on the horizontal windup direction.
- Radial-style enemy attacks (`attackStyle === 'radial'`, e.g. grunt, spawner, annex_overseer) hit targets within the 3D sphere and miss targets at the same `(x, z)` but outside vertical range.
- `updateAreaEffects()` `volatile_explosion` branch damages players and minions with 3D distance (not inline `Math.hypot(dx, dz)`); enemy hits continue through `collectRadialHits`.
- `inferno_pillar` area-effect ticks use spherical inclusion (via updated `collectRadialHits` and/or stored `originY` on the effect record).
- `updateEnchantments()` spike_trap / cinder_snare trigger radius uses 3D distance from enchantment position (resolve enchantment Y from floor sampling at `enc.x, enc.z` or stored `enc.y` when present).
- `triggerMirrorWard` radial fallback (`enc.reflectRange`) uses 3D `collectRadialHits` from the player's world Y.
- Tests in `game/server/test/spherical_aoe.test.js` (extend) and/or `game/server/test/volatile_explosion.test.js` and `game/server/test/annex_overseer.test.js` cover at least one height-in / height-out case per category above without breaking flat-ground radial strike behavior.

## Technical Specs

- `game/server/simulation.js`:
  - `pullEnemiesToward`, `applyEventHorizon`, `isEntityInEnemyAttack`, `updateAreaEffects`, `updateEnchantments`, `triggerMirrorWard`.
  - `spawnInfernoPillarEffect` / `spawnVolatileExplosion`: store `originY` on the pushed area-effect object (from detonation/cast position) so tick resolution has a stable vertical center.
- `game/server/test/spherical_aoe.test.js`: enemy radial, pull, volatile explosion, and enchantment trigger height cases.
- `game/server/test/volatile_explosion.test.js`: add height-aware inclusion/exclusion case(s) if not covered in spherical_aoe.test.js.

## Verification: code
