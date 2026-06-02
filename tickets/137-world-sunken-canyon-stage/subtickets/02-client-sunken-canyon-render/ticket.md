# Client: render Sunken Canyon multi-level geometry

Make the client correctly draw the sunken-canyon layout produced by sub-ticket
01: sloped plateau, ramps, and canyon floor; cover pieces on the canyon;
treasure marker and camera spawn aligned to actual floor height (not flat
`FLOOR_Y`).

## Acceptance Criteria

- `buildDungeon(layout)` with `profile: 'sunken-canyon'` renders one sloped or
  flat floor mesh per room (plateau, each ramp, canyon) using the existing
  `buildSlopedFloor` / uniform-floor branches — no z-fighting at band junctions
  beyond the known box-mesh approximation.
- Every `layout.cover` entry on the canyon renders as a box mesh resting on
  `sampleFloorY(layout, c.x, c.z)` (same as open-plaza).
- **Treasure marker** (cylinder on `role: 'treasure'`) is positioned at
  `sampleFloorY(layout, room.x, room.z) + offset`, not `FLOOR_Y`, so the exit
  marker sits on the canyon floor.
- **`initScene`**: initial `camera.lookAt` uses the spawn floor Y from
  `sampleFloorY(layout, spawnPos.x, spawnPos.z)` (fallback `DEFAULT_FLOOR_Y`),
  not hard-coded `y: 0`, so a plateau spawn does not aim the camera underground.
- `buildWallColliders()` includes cover footprints (already required for
  open-plaza); add/extend a client unit test with a synthetic sunken-canyon
  layout asserting mesh counts (rooms + cover) and treasure marker Y >
  `DEFAULT_FLOOR_Y` when the treasure room is in the low canyon band.
- Layouts without `cover` / with only flat rooms behave exactly as before.

## Technical Specs

- `game/client/dungeon.js`:
  - In the treasure-marker block, replace `0.75 + FLOOR_Y` with
    `(sampleFloorY(layout, room.x, room.z) ?? DEFAULT_FLOOR_Y) + 0.75`.
  - Confirm the room loop already calls `buildSlopedFloor` for non-uniform
    `floorCorners` (ramps and sloped plateau edges need no new geometry path).
- `game/client/renderer.js`:
  - In `initScene`, after `spawnPos` is set, compute `spawnFloorY =
    sampleFloorY(layout, spawnPos.x, spawnPos.z) ?? DEFAULT_FLOOR_Y` and pass
    it to `camera.lookAt(spawnPos.x, spawnFloorY, spawnPos.z)`.
  - Import `sampleFloorY` / `DEFAULT_FLOOR_Y` from the shared floor-sampling
    module used elsewhere on the client.
- `game/client/test/dungeon.test.js`: add a describe block with a minimal
  sunken-canyon-shaped fixture (plateau room high corners, canyon room low
  corners, one ramp, two cover pieces, canyon `role: 'treasure'`) and assert
  treasure marker mesh Y and cover mesh bases.

## Verification: code
