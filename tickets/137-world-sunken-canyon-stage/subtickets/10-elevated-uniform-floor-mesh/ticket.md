# Elevated uniform floor mesh Y

Sunken Canyon plateau and canyon rooms use uniform `floorCorners` at Y=10 and Y=2, but `buildDungeon()` still places their flat floor meshes at legacy `FLOOR_Y` (0.05). Players, walls, and camera already use sampled floor height, so the visible floor surfaces do not show the required two elevation bands. Fix client rendering so uniform rooms with explicit non-default corner Y draw at that elevation, and align treasure markers and passage geometry with sampled floor height.

## Acceptance Criteria

- Uniform rooms with explicit `floorCorners` where all four corners share the same Y **≠** `DEFAULT_FLOOR_Y` (0) render their flat floor mesh center at that corner Y (not at `FLOOR_Y`).
- Legacy flat rooms (missing `floorCorners`, or uniform corners at Y=0) still render at `FLOOR_Y` with no rotation — no regression for default dungeons.
- Sloped rooms (non-uniform `floorCorners`) are unchanged; they still use `buildSlopedFloor()`.
- Treasure room marker Y is `sampleFloorY(layout, room.x, room.z) + 0.75` (or equivalent constant offset), not `0.75 + FLOOR_Y`.
- Passage floor meshes and passage side walls use `sampleFloorY(layout, x, z)` at their placement point (with the same small z-fight offset pattern as room floors), not hardcoded `FLOOR_Y`.
- For `generateLayout(42, undefined, { stage: 'sunken-canyon', slopes: true })`: plateau room floor mesh Y ≈ 10, canyon floor mesh Y ≈ 2, and plateau Y − canyon Y ≥ 8.
- Client tests in `game/client/test/dungeon.test.js` cover elevated uniform floors and sunken-canyon band mesh Y; tests no longer assert that all uniform `floorCorners` rooms sit at `FLOOR_Y`.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/client/dungeon.js`**:
  - Add a small helper, e.g. `uniformFloorElevation(room)`, returning the shared corner Y when `isUniformFloor(room)` and `floorCorners` is present, else `null`.
  - In the room floor branch for uniform floors: if `uniformFloorElevation(room)` is a finite number, set mesh `position.y` to that value (optionally `+ FLOOR_Y` only when elevation is 0 to preserve legacy z-fighting — prefer matching wall/player sampled Y at room center); otherwise keep current `FLOOR_Y` behavior.
  - Treasure marker: replace `0.75 + FLOOR_Y` with `0.75 + (sampleFloorY(layout, room.x, room.z) ?? DEFAULT_FLOOR_Y)`.
  - Passage loop: compute `passageFloorY = sampleFloorY(layout, floorSpec.x, floorSpec.z) ?? DEFAULT_FLOOR_Y` for floor mesh Y; base passage wall meshes on the same sampled Y at each wall segment (mirror room-wall pattern).
  - Export the helper if tests need it.
- **`game/client/test/dungeon.test.js`**:
  - Update `buildDungeon() with floorCorners` cases: uniform corners at Y=0.5 should expect mesh Y ≈ 0.5, not `FLOOR_Y`; legacy absent/`Y=0` cases still expect `FLOOR_Y`.
  - Add a sunken-canyon integration test importing server `generateLayout` with `{ stage: 'sunken-canyon', slopes: true }`, seed 42: locate plateau (`elevationBand === 'plateau'`) and canyon floors by room role/band, assert mesh Y values and drop ≥ 8.
- **Out of scope**: server layout generator, camera logic (`05-camera-plateau-vista` already passed), enemy Y (`07-enemy-sampled-floor-y` already passed).

## Verification: code
