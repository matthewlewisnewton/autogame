# 08 — Barrier dome spherical 3D radius

`barrier_dome` still stores only XZ center coordinates and `damagePlayer()` decides dome membership with `Math.hypot(dx, dz)`, so elevated victims/attackers at the same XZ are treated as inside a flat cylinder. Store cast-time Y and use 3D spherical distance for both victim and attacker dome checks.

## Acceptance Criteria

- Casting `barrier_dome` sets `player.barrierDomeY = getEntityWorldY(player)` alongside `barrierDomeX` / `barrierDomeZ`.
- `damagePlayer()` dome blocking uses `distance3D(dome.barrierDomeX, domeY, dome.barrierDomeZ, victim)` for victim membership and the same origin for attacker membership (resolve `domeY` from `barrierDomeY` when finite, else `resolveRadialOriginY(dome.barrierDomeX, dome.barrierDomeZ, {})`).
- Ranged damage from outside the sphere to a victim inside the sphere is blocked; ranged damage from an attacker inside the sphere to a victim inside is **not** blocked (existing behavior preserved on flat ground).
- A victim at the same `(x, z)` but beyond vertical range of the dome center is **not** protected (damage applies).
- An attacker at the same `(x, z)` but beyond vertical range is treated as outside and blocked damage to an in-sphere victim.
- Existing flat-ground `game/server/test/barrier_dome.test.js` cases continue to pass.
- New height in-sphere / out-of-sphere cases are added to `game/server/test/barrier_dome.test.js`.

## Technical Specs

- `game/server/keyItemEffects.js` — in the `barrier_dome` branch (~line 149): import/use existing `getEntityWorldY`; set `player.barrierDomeY = getEntityWorldY(player)` when casting.
- `game/server/simulation.js` — in `damagePlayer()` barrier-dome loop (~line 2479): replace `Math.hypot(dx, dz)` victim/attacker checks with `distance3D` using stored `barrierDomeY`; for attacker position use `getEntityWorldY(attackerPos)` or enemy Y from `getAttackerPosition` result.
- `game/server/test/barrier_dome.test.js` — add unit cases with `barrierDomeY` set explicitly:
  - elevated victim inside 3m radius at same XZ is protected from outside ranged damage;
  - elevated victim outside vertical radius at same XZ is **not** protected;
  - attacker elevated outside vertical radius at same XZ still blocked when victim is in-sphere.

## Verification: code
