# Cliff-edge lip markers at descent routes

Add emissive lip strips where players step off the plateau onto descent ramps so the
~10u vertical drop reads at a glance without changing walkability or collision.

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon')` emits `layout.cliffLips` (array): one strip per
  ramp at the **high (plateau) mouth** of each descent route, with AABB fields
  `{ minX, maxX, minZ, maxZ, y }` aligned to the ramp width and plateau-edge inset.
- Strips must not overlap ramp walkable centres or block the existing flood-fill routes
  (walkability tests in `sunken_canyon_walkability.test.js` and `dungeon.test.js` stay
  green).
- `buildDungeon` renders each cliff lip as a low emissive mesh (distinct
  `userData.dungeonTag`, e.g. `canyonCliffLip`) using profile accent/warning colors;
  meshes are included in the returned `meshes` list.
- Lip placement is deterministic for a fixed seed.
- Client unit tests assert lip mesh count matches `layout.cliffLips.length` for a
  server-generated sunken-canyon layout and that lips sit at or above the high-band floor Y.

## Technical Specs

- **`game/server/dungeon.js`**
  - In `generateSunkenCanyon`, after ramp rooms are built, compute `cliffLips` from ramp
    centres (`rampCenters`), `rampWidth`, `yHigh`, and plateau south edge Z. Reuse
    `SUNKEN_CANYON` tuning constants for strip width/inset.
  - Return `cliffLips` on the layout object (default `[]` for other profiles).
- **`game/client/dungeon.js`**
  - Add `buildCanyonCliffLipMesh(lip)` (or generalize a shared lip-strip builder) and loop
    `layout.cliffLips || []` in `buildDungeon` after room floors, before cover/landmarks.
- **`game/server/test/dungeon.test.js`**
  - In the `sunken-canyon` describe block: assert `cliffLips.length ===` ramp count (4–5),
    each lip `y` equals plateau high Y, and lips align with ramp X centres.
- **`game/client/test/dungeon.test.js`**
  - Assert tagged lip meshes for `generateLayout(42, 'sunken-canyon')`.

## Verification: code
