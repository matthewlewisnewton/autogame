# 02 — Persistent area effects and cone hits go spherical

Make the persistent/DoT area effects (inferno_pillar, dragons_breath, fire_trail, volatile_explosion) and `collectConeHits` resolve in 3D: spawners record the cast origin's Y (and vertical aim for cones), and every tick in `updateAreaEffects` — including the volatile-explosion loops over minions and players — uses 3D spherical distance instead of XZ-only checks.

## Acceptance Criteria

- [ ] `spawnInfernoPillarEffect`, `spawnDragonsBreathEffect`, `spawnFireTrailEffect`, and `spawnVolatileExplosion` store `originY` on the pushed area-effect object (caster's world Y, or floor Y at the blast point for volatile explosions); dragons_breath and fire_trail effects also store `dirY` from the cast aim.
- [ ] `updateAreaEffects` passes `originY` into `collectRadialHits` (inferno_pillar, volatile_explosion) and into `collectConeHits` (dragons_breath, fire_trail), and the volatile_explosion minion loop and player loop use 3D distance (`Math.hypot(dx, dy, dz)` with target Y via `getEntityWorldY`) instead of `Math.hypot(dx, dz)`.
- [ ] `collectConeHits` always computes the range check as 3D distance (origin Y vs `getEntityWorldY(enemy)`), and the angle check as a 3D dot product using `dirY` (0 for flat aims); the old 2D fallback that hard-gated targets at `Math.abs(dy) > PROJECTILE_HIT_WIDTH` is removed. A flat-aimed cone therefore hits a slightly-elevated enemy inside the cone, but not an enemy directly overhead (fails the angle check) nor one beyond the 3D range.
- [ ] All `collectConeHits` callers pass the new origin-Y information: dragons_breath initial cast in `game/server/cardEffects.js`, weapon-cone attacks if they share the helper, the minion shockwave_sweep attack (~line 3245 in simulation.js, use the minion's world Y with flat aim), and area-effect ticks.
- [ ] New tests in `game/server/test/` verify: (a) an inferno_pillar tick damages an enemy elevated within the sphere and excludes an enemy XZ-inside but 3D-outside; (b) a volatile_explosion damages an elevated player and an elevated minion within the sphere and excludes both when 3D-outside; (c) dragons_breath DoT ticks respect the 3D range; (d) a flat cone no longer hits an enemy whose dy alone exceeds the range, and does hit a slightly-elevated in-cone enemy.
- [ ] `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/server/simulation.js`:
  - `collectConeHits` (~line 1369): drop the `use3D` branching for the distance — always `Math.hypot(dx, dy, dz)` with `dy = getEntityWorldY(enemy) - originY`; keep the 3D dot-product angle check (`(dirX*dx + dirY*dy + dirZ*dz) / dist`) for all aims; remove the `!use3D && Math.abs(dy) > PROJECTILE_HIT_WIDTH` continue. Signature gains origin Y (follow the same convention chosen in sub-ticket 01, e.g. an `originY` in `options` or positional — be consistent with `collectRadialHits`).
  - `spawnFireTrailEffect` (~line 1909), `spawnDragonsBreathEffect` (~line 1932), `spawnInfernoPillarEffect` (~line 1956), `spawnVolatileExplosion` (~line 1988): accept/record `originY` (and `dirY` for the two cone effects); update their callers (`game/server/cardEffects.js` dragons_breath/inferno_pillar handlers ~lines 879/920, fire-trail caller, volatile-death caller in simulation.js).
  - `updateAreaEffects` (~line 2005): thread `effect.originY` into every hit collection; convert the minion loop (~line 2024) and player loop (~line 2029) to 3D.
- `game/server/cardEffects.js`: dragons_breath already computes a 3D aim via `aimForProjectile` (`dirY`) — pass the caster Y + `dirY` into the spawned effect; inferno_pillar passes caster Y.
- Depends on sub-ticket 01 (`collectRadialHits` 3D signature, exported spherical helper).
- Out of scope: enemy attack resolution (03), barrier dome/smoke (04), projectile travel/hit logic (already 3D via `proximityToSample`).

## Verification: code
