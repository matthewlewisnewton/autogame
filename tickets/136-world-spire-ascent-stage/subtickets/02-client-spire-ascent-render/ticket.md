# Client: render Spire Ascent multi-tier geometry

Make the client correctly draw the spire-ascent layout from sub-ticket 01:
stacked tier platforms, sloped ramps between them, and floor-height-aligned spawn /
treasure / camera setup so ascending players stay visually grounded.

## Acceptance Criteria

- `buildDungeon(layout)` with `profile: 'spire-ascent'` renders one sloped or flat
  floor mesh per room (each tier platform and each ramp) via the existing
  `buildSlopedFloor` / uniform-floor branches — no new geometry type required.
- **Treasure marker** on the top-tier `role: 'treasure'` room uses
  `sampleFloorY(layout, room.x, room.z) + offset`, not hard-coded `FLOOR_Y`, so
  the exit marker sits on the elevated top platform.
- **`initScene`**: initial `camera.lookAt` uses spawn floor Y from
  `sampleFloorY(layout, spawnPos.x, spawnPos.z)` (already the pattern for
  sunken-canyon); verify it still applies when spawn Y is at the spire base.
- **Camera follow during play**: `updateCameraOrbit` uses `playerY` for
  `targetY` and `lookAt` (no hard-coded ground plane). Add or extend a unit test
  asserting camera target/lookAt Y tracks a rising `playerY` (synthetic layout +
  mocked player state) so ascent does not leave the camera stuck at y ≈ 0.5.
- If the spire total height exceeds default `CAMERA_FAR`, bump far clip (or
  camera height offset) only as needed so top-tier geometry is not clipped in
  normal third-person follow — covered by a code assertion on `CAMERA_FAR` vs
  max tier Y + margin.
- Layouts without `spire-ascent` profile behave exactly as before.

## Technical Specs

- `game/client/dungeon.js`:
  - Confirm treasure-marker block uses
    `(sampleFloorY(layout, room.x, room.z) ?? DEFAULT_FLOOR_Y) + 0.75` for all
    treasure rooms (should already be true post–sunken-canyon; add spire-ascent
    fixture coverage).
  - Confirm room loop uses `buildSlopedFloor` for ramp `floorCorners` and flat
    meshes for uniform tier platforms.
- `game/client/renderer.js`:
  - Verify `initScene` spawn `lookAt` uses `sampleFloorY` (no regression).
  - In `updateCameraOrbit`, confirm `targetY = playerY + CAMERA_HEIGHT` and
    `lookAt(playerX, playerY, playerZ)` — document that spire ascent relies on
    server `player.y` from ticket 117; add a focused unit test if none exists.
  - Adjust `CAMERA_FAR` (or related constant) only if tests show clipping at max
    spire height (~DEFAULT_FLOOR_Y + 10+ margin).
- `game/client/test/dungeon.test.js`: add a describe block with a minimal
  spire-ascent fixture (bottom tier at Y 0.5, top tier at Y ≥ 10.5, two ramps,
  top `role: 'treasure'`) asserting treasure marker mesh Y > `DEFAULT_FLOOR_Y` +
  9 and ramp floor meshes are created.
- `game/client/test/` (renderer or collision test file): assert camera orbit Y
  follows elevated `playerY`.

## Verification: code
