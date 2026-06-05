# 01 — Dedupe overlapping ramp side walls

When `generateSunkenCanyon` places three `rampWidth: 4` descent rooms at `rampXOffsets` `[-3.5, 0, 3.5]`, adjacent ramp rooms overlap in X and each emits a full pair of `axis: 'z'` side walls. Interior walls end up ~0.5 units apart near `x ≈ ±2`, narrower than player diameter, so movement code wedges the avatar solid.

Remove or merge interior ramp side walls wherever ramp room X intervals overlap, so only the outermost walls of the combined corridor remain.

## Acceptance Criteria

- For every seed in `[1..30]` that yields three ramp rooms, no two ramp-room `axis: 'z'` wall segments (vertical walls at fixed `x`) are separated by less than `2 * PLAYER_RADIUS` (`PLAYER_RADIUS` from `game/server/simulation.js`, currently `0.5`) when both walls lie on the same ramp `z` span.
- For seeds `42` and `999` with three ramps, a grid walk at fixed `z = rampZ` can step from `x = -3` to `x = 3` without colliding with wall colliders expanded by `PLAYER_RADIUS` (use the same `isWalkable` / `buildWallColliders` helpers as `game/server/test/dungeon.test.js`).
- Existing sunken-canyon layout shape tests in `game/server/test/dungeon.test.js` (room counts, band roles, Y drop, slopes) still pass unchanged.

## Technical Specs

- **`game/server/dungeon.js`**
  - In `generateSunkenCanyon`, after choosing `rampCenters` / building ramp rooms, compute each ramp’s X interval `[x - width/2, x + width/2]`.
  - When building ramp rooms via `buildDescentRampRoom`, suppress the west (`x - halfW`) or east (`x + halfW`) side wall if that edge lies inside another selected ramp’s interval (only emit the outer boundary of the merged corridor).
  - Optionally add a small helper (e.g. `buildDescentRampRoomWithOpenSides`) rather than duplicating wall logic; keep `buildDescentRampRoom` default behaviour unchanged for spire-ascent.
- **No client changes** — walkability is server layout + colliders only.

## Verification: code
