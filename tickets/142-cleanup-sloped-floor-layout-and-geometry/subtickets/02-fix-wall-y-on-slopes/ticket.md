# Fix wall Y position on sloped rooms

`buildDungeon()` places room walls at `WALL_HEIGHT / 2 + FLOOR_Y` (constant `0.05`) even when the room's floor uses corner heights of `0.5`–`2.0`. On ramp rooms, wall bases appear to float or clip relative to the inclined floor. Position walls using `sampleFloorY()` at the wall's center.

## Acceptance Criteria
- Room wall meshes on sloped rooms have `position.y` aligned with `sampleFloorY(layout, wallX, wallZ) + WALL_HEIGHT / 2`.
- Flat rooms (uniform `floorCorners` or absent) continue to render identically (no visual regression).
- Existing unit tests in `client/test/dungeon.test.js` continue to pass.
- A new unit assertion verifies wall `position.y` on a sloped room matches `sampleFloorY` output within epsilon.

## Technical Specs
- **File**: `game/client/dungeon.js`
  - Import `sampleFloorY` from `../shared/floorSampling.esm.js` (or re-export via `./collision.js`).
  - In the room-wall loop (line ~244), replace `WALL_HEIGHT / 2 + FLOOR_Y` with `sampleFloorY(layout, wallX, wallZ) + WALL_HEIGHT / 2`, falling back to `DEFAULT_FLOOR_Y` when `sampleFloorY` returns `null`.
- **File**: `game/client/test/dungeon.test.js`
  - Add a test that builds a dungeon with a sloped room and asserts wall `position.y` matches `sampleFloorY(layout, wallX, wallZ) + WALL_HEIGHT / 2`.

## Verification: code
