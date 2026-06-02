# Client: Spire Ascent dungeon render

Ensure the client dungeon builder correctly renders the spire-ascent layout:
elevated tier floors, sloped ramp slabs, and the treasure/exit marker on the
**top** tier at the correct world Y.

## Acceptance Criteria

- `buildDungeon(scene, layout)` for a server-generated `generateLayout(seed,
  'spire-ascent')` layout produces meshes for every tier and ramp room without
  errors.
- **Tier floors** sit at their layout Y: bottom tier near `DEFAULT_FLOOR_Y`,
  top tier clearly elevated (marker and floor mesh `position.y` both above
  `DEFAULT_FLOOR_Y + 8`).
- **Ramp rooms** use `buildSlopedFloor` (non-uniform `floorCorners`) and render
  as rotated floor slabs bridging adjacent tiers.
- **Treasure / exit marker** is placed on the **top tier** (`role === 'treasure'`)
  at `sampleFloorY(layout, treasure.x, treasure.z) + 0.75`, not on the spawn
  tier.
- **Perimeter walls** from the layout appear in the scene (wall mesh count ≥
  total wall segments across tiers and ramps).
- Unit tests in `game/client/test/dungeon.test.js` (new
  `describe('spire-ascent floors & treasure marker')` block) cover: mesh counts,
  elevated top-tier floor, sloped ramp floor, treasure marker Y, and a
  server-generated layout integration case (mirror the `sunken-canyon` client
  tests).

## Technical Specs

- `game/client/dungeon.js`:
  - No bespoke mesh type required if tier/ramp rooms already flow through
    `uniformFloorMeshY` / `buildSlopedFloor` / existing wall builders — fix only
    gaps found when rendering `band: 'tier'` and `band: 'ramp'` rooms.
  - Confirm `buildDungeon` places the treasure cylinder on the `treasure` role
    room using `sampleFloorY` (same path as sunken-canyon canyon marker).
- `game/client/test/dungeon.test.js`:
  - Add fixture layout with 3 tiers + 2 ramps and ascending `floorCorners`.
  - Import `generateLayout` from `../../server/dungeon.js` for one integration
    test with `generateLayout(42, 'spire-ascent')`.
- `game/shared/floorSampling.esm.js`: read-only reference for expected Y values
  in assertions (no change unless sampling bug found).

## Verification: code
