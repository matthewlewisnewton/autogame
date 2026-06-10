# 04 — Defensive zone radius effects go spherical (barrier dome + smoke bomb)

Convert the two player defensive zone effects from flat XZ circles to spheres: the barrier_dome projectile-block checks in `damagePlayer` and the smoke_bomb concealment check in `isPlayerConcealed`. Both zones record the caster's world Y at cast time so inside/outside is judged against a 3D sphere.

## Acceptance Criteria

- [ ] Casting barrier_dome records `player.barrierDomeY` and casting smoke_bomb records `player.smokeBombY` (caster world Y via `getEntityWorldY`) alongside the existing X/Z in `game/server/keyItemEffects.js`.
- [ ] The barrier-dome block in `damagePlayer` treats a victim as inside the dome only when their 3D distance to (barrierDomeX, barrierDomeY, barrierDomeZ) is ≤ radius; the attacker inside/outside test is also 3D (attacker Y from the attacker position when available, falling back to floor Y at the attacker's XZ). A victim hovering above the dome sphere (XZ-inside, 3D-outside) is NOT protected.
- [ ] `isPlayerConcealed` treats a player as concealed only when their 3D distance to (smokeBombX, smokeBombY, smokeBombZ) is ≤ radius — a player elevated above the smoke sphere is targetable.
- [ ] When the recorded zone Y is missing (e.g. state persisted before this change), the checks fall back to floor Y at the zone's XZ — never to 2D behavior.
- [ ] Existing barrier dome and smoke tests still pass (`game/server/test/barrier_dome.test.js` and any smoke/conceal tests), updated only if they relied on 2D semantics.
- [ ] New tests in `game/server/test/` verify, for both zones: same-height behavior unchanged (inside blocks/conceals, outside doesn't), and an XZ-inside but 3D-outside entity is not protected/concealed.
- [ ] `pnpm test:quick` (from `game/`) passes.

## Technical Specs

- `game/server/keyItemEffects.js` (~lines 154, 173): add `player.barrierDomeY = …` / `player.smokeBombY = …` using `getEntityWorldY(player)` (import from `./simulation` like the other helpers).
- `game/server/simulation.js`:
  - `damagePlayer` barrier-dome section (~lines 2436–2452): convert `victimDist` and `attackerDist` to 3D using the spherical helper from sub-ticket 01; resolve victim Y via `getEntityWorldY(player)`; attacker Y from `attackerPos.y` if finite, else floor at `(attackerPos.x, attackerPos.z)`.
  - `isPlayerConcealed` (~line 1159): convert the `Math.hypot(dx, dz) <= radius` check to 3D against `owner.smokeBombY`.
- Depends on sub-ticket 01 only for the exported spherical-distance helper.
- Out of scope: dome/smoke visuals on the client, durations, radii values.

## Verification: code
