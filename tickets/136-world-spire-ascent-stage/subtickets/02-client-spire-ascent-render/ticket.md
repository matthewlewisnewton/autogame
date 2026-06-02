# Client: render Spire Ascent multi-tier geometry

Make the client correctly draw the spire-ascent layout from sub-ticket 01: one
sloped or flat floor mesh per tier and ramp, treasure marker on the top tier at
true floor height, and camera spawn aimed at the bottom-tier floor (not flat
`DEFAULT_FLOOR_Y`).

## Acceptance Criteria

- `buildDungeon(layout)` with `profile: 'spire-ascent'` renders one floor mesh
  per room (each tier + each ramp) using existing `buildSlopedFloor` / uniform-floor
  branches — no z-fighting at tier–ramp junctions beyond the known box-mesh
  approximation.
- **Treasure marker** (`role: 'treasure'`, top tier) is positioned at
  `sampleFloorY(layout, room.x, room.z) + 0.75`, not `FLOOR_Y`, so the exit sits
  on the highest platform (Y well above `DEFAULT_FLOOR_Y`).
- **`initScene`**: initial `camera.lookAt` uses spawn floor Y from
  `sampleFloorY(layout, spawnPos.x, spawnPos.z)` (already required for canyon;
  confirm it works when spawn is on the bottom tier of a spire layout).
- **Camera follow**: `updateCameraOrbit` continues to use server-synced `playerY`
  (not hard-coded floor constant) so ascending the ramps raises the camera with
  the avatar; no client change that pins the local mesh or camera to `DEFAULT_FLOOR_Y`
  while `player.y` increases.
- Client unit tests in `game/client/test/dungeon.test.js`: minimal spire-ascent
  fixture (3 tiers, 2 ramps, bottom `start`, top `treasure`) asserting mesh counts,
  bottom tier floor Y ≈ `DEFAULT_FLOOR_Y`, top tier / treasure marker Y >
  `DEFAULT_FLOOR_Y + 8`, and ramp rooms use sloped floor meshes.
- Layouts without `spire-ascent` profile behave exactly as before.

## Technical Specs

- `game/client/dungeon.js`:
  - Confirm treasure-marker block already uses `sampleFloorY` (from sunken-canyon
    work); no regression for high treasure rooms.
  - Confirm room loop calls `buildSlopedFloor` for ramps and uniform floors for
    flat tiers — no new geometry path unless a tier corner is intentionally non-uniform.
- `game/client/renderer.js`:
  - Confirm `initScene` `spawnFloorY` via `sampleFloorY` (lines ~810–813).
  - Confirm `updateCameraOrbit(playerX, playerY, playerZ, …)` uses `playerY +
    CAMERA_HEIGHT` and `lookAt(playerX, playerY, playerZ)` — document that spire
    ascent depends on server `player.y` from `applyPlayerMovement` / `sampleFloorY`.
- `game/client/test/dungeon.test.js`:
  - Add `spireAscentFixture()` (3 tiers ascending in Y, 2 ramps, `profile:
    'spire-ascent'`) and tests mirroring the sunken-canyon describe block: mesh
    count, treasure marker Y on top tier, bottom tier floor elevation, sloped ramp
    floors.
  - Add one test using `generateLayout(42, 'spire-ascent')` once sub-ticket 01
    lands (treasure marker Y ≥ bottom tier Y + 8).

## Verification: code
