# Client: render fire-cavern multi-level geometry

Make the client correctly draw the `fire-cavern` layout from sub-ticket 01:
sloped rim, ramps, and basin floor; cover pieces on the basin; treasure marker
and camera spawn aligned to actual floor height via `sampleFloorY` (not flat
`DEFAULT_FLOOR_Y`).

## Acceptance Criteria

- `buildDungeon(layout)` with `profile: 'fire-cavern'` renders one sloped or flat
  floor mesh per room (rim, each ramp, basin) using existing `buildSlopedFloor` /
  uniform-floor branches — no z-fighting at band junctions beyond the known
  box-mesh approximation.
- Every `layout.cover` entry on the basin renders as a box mesh resting on
  `sampleFloorY(layout, c.x, c.z)` (same as open-plaza / sunken-canyon).
- **Treasure marker** (`role: 'treasure'`, basin) is positioned at
  `sampleFloorY(layout, room.x, room.z) + 0.75`, not `FLOOR_Y`, so the exit sits
  on the lower basin floor.
- **`initScene`**: initial `camera.lookAt` uses spawn floor Y from
  `sampleFloorY(layout, spawnPos.x, spawnPos.z)` (fallback `DEFAULT_FLOOR_Y`), so
  a rim spawn does not aim the camera underground.
- **Camera follow**: `updateCameraOrbit` continues to use server-synced `playerY`
  so descending the ramps lowers the camera with the avatar.
- Client unit tests in `game/client/test/dungeon.test.js`: minimal fire-cavern
  fixture (rim room high corners, basin room low corners, one ramp, two cover
  pieces, basin `role: 'treasure'`) asserting mesh counts, treasure marker Y <
  rim floor Y, and ramp rooms use sloped floor meshes.
- One test using `generateLayout(42, 'fire-cavern')` asserts treasure marker Y ≥
  `DEFAULT_FLOOR_Y` and rim spawn floor Y > treasure marker Y (floor alignment).
- Layouts without `fire-cavern` profile behave exactly as before.

## Technical Specs

- `game/client/dungeon.js`:
  - Confirm treasure-marker block uses `sampleFloorY` (from sunken-canyon work);
    no regression for low-basin treasure rooms.
  - Confirm room loop calls `buildSlopedFloor` for non-uniform `floorCorners`
    (ramps need no new geometry path).
  - Add `resolveFireCavernRoomMaterials(room, layout)` stub or band-aware branch
    (`rim` / `ramp` / `basin`) that falls back to `getProfileMaterials('fire-cavern')`
    until sub-ticket 04 lands per-band tints — geometry must render even before
    themed colors exist.
- `game/client/renderer.js`:
  - Confirm `initScene` `spawnFloorY` via `sampleFloorY` (~lines 810–813).
  - Confirm `updateCameraOrbit(playerX, playerY, playerZ, …)` uses `playerY +
    CAMERA_HEIGHT` and `lookAt(playerX, playerY, playerZ)`.
- `game/client/test/dungeon.test.js`:
  - Add `fireCavernFixture()` (rim high, basin low, one ramp, `profile:
    'fire-cavern'`) and tests mirroring the sunken-canyon describe block.
  - Add `generateLayout(42, 'fire-cavern')` integration test for treasure marker
    and rim/basin Y ordering.

## Verification: code
