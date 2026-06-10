# 09 — Phase step spherical 3D range

`phase_step` still picks the nearest ally and validates range with XZ-only `Math.hypot(dx, dz)`, so an ally directly above or below the caster can be swapped when outside the intended spherical range. Convert nearest-ally selection and the range gate to 3D distance.

## Acceptance Criteria

- Nearest-ally auto-targeting compares `distance3D(player.x, casterY, player.z, candidate)` where `casterY = getEntityWorldY(player)`.
- The `out_of_range` gate uses the same 3D distance between caster and chosen ally against `def.range` (default 6).
- Explicit `targetPlayerId` selection still requires the ally to be within 3D range; otherwise returns `out_of_range`.
- An ally at the same `(x, z)` within vertical range (e.g. ±3m with 6m range) can be swapped successfully.
- An ally at the same `(x, z)` beyond vertical range (e.g. 8m above with 6m range) returns `out_of_range` and does not burn cooldown.
- Existing flat-ground `game/server/test/phase_step.test.js` cases continue to pass.
- New elevated in-range / out-of-range cases are added to `game/server/test/phase_step.test.js`.

## Technical Specs

- `game/server/keyItemEffects.js` — in the `phase_step` branch (~line 452):
  - Replace nearest-candidate loop `Math.hypot(p.x - player.x, p.z - player.z)` with `distance3D(player.x, getEntityWorldY(player), player.z, p)`.
  - Replace range check `Math.hypot(ally.x - player.x, ally.z - player.z)` with the same 3D helper.
- `game/server/test/phase_step.test.js` — add two-player socket tests:
  - caster and ally share XZ, ally `y` offset within range → swap succeeds (`ok: true`);
  - caster and ally share XZ, ally `y` offset beyond range → `ok: false`, `reason: 'out_of_range'`, positions unchanged, cooldown not burned.

## Verification: code
