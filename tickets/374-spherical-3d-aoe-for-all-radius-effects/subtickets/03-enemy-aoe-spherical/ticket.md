# 03 — Enemy AoE goes spherical (attack resolution + field medic heal)

Make enemy-side radius effects symmetric with player AoE: enemy attack hit resolution (`isEntityInEnemyAttack` — both radial shockwave-style and cone-style attacks) and the Field Medic's heal-in-radius use 3D spherical distance instead of XZ-only checks. This is the "prep for flying enemies" half — an enemy at height resolves its attacks against the sphere, and is healed/hit within spheres.

## Acceptance Criteria

- [ ] `isEntityInEnemyAttack(enemy, target)` computes range as 3D distance using `getEntityWorldY` for both enemy and target. A target whose XZ distance is within `attackRange` but whose 3D distance exceeds it (e.g. on a ledge above) is NOT hit; a target at moderate height whose 3D distance is within range IS hit.
- [ ] For `attackStyle === 'cone'` enemies, the angle check uses a 3D dot product with the stored wind-up direction (`windupDirX/windupDirY/windupDirZ` — already computed in 3D by `computeAimDirection3D` at wind-up start); radial-style attacks (e.g. the room-guardian "radial shockwave") are a pure sphere check.
- [ ] `healFieldMedicAlly` selects heal targets by 3D distance ≤ `medic.healRadius` (ally Y via `getEntityWorldY`), so an elevated wounded ally inside the sphere can be healed and an XZ-close but 3D-far ally cannot.
- [ ] Detection/chase AI (`DETECTION_RADIUS` target acquisition, `findNearestVisiblePlayer`) is intentionally left unchanged — the diff does not touch those checks.
- [ ] New tests in `game/server/test/` verify: (a) a radial enemy attack misses a player XZ-inside but 3D-outside `attackRange` and hits an elevated player 3D-inside; (b) a cone enemy attack respects the 3D range; (c) the field medic heals only allies inside the 3D sphere.
- [ ] `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/server/simulation.js`:
  - `isEntityInEnemyAttack` (~line 1111): compute `dy = getEntityWorldY(target) - getEntityWorldY(enemy)`, use `Math.hypot(dx, dy, dz)` for the range gate; in the cone branch include `dy` and `enemy.windupDirY ?? 0` in the dot product (normalize by the 3D dist as `collectConeHits` does). `isPlayerInEnemyAttack` (~line 1131) inherits the fix.
  - `healFieldMedicAlly` (~line 2544): replace `Math.hypot(ally.x - medic.x, ally.z - medic.z)` with the 3D distance (use the spherical helper exported in sub-ticket 01).
  - Do NOT change `findNearestVisiblePlayer` (~line 2530) or the chasing-loop `DETECTION_RADIUS` checks (~line 2814) — targeting AI is out of scope.
- Tests: new file e.g. `game/server/test/enemy_aoe_spherical.test.js` following the existing pattern (mutate `gameState`, set `enemy.y` / `player.y`, drive `isEntityInEnemyAttack` / `healFieldMedicAlly` directly; see `game/server/test/airborne.test.js` for entities with `y` set).
- Independent of sub-tickets 01/02 except for the exported spherical-distance helper from 01.

## Verification: code
