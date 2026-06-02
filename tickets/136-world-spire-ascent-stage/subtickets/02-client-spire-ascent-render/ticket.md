# Client: render Spire Ascent multi-tier geometry

Make the client correctly draw the spire-ascent layout from sub-ticket 01:
flat tier platforms at increasing Y, sloped ramp meshes between tiers, and
spawn/treasure/camera heights aligned to actual floor elevation (not flat
`FLOOR_Y`).

## Acceptance Criteria

- `buildDungeon(layout)` with `profile: 'spire-ascent'` renders one sloped or
  flat floor mesh per room (each tier and each ramp) using the existing
  `buildSlopedFloor` / uniform-floor branches — no z-fighting at tier/ramp
  junctions beyond the known box-mesh approximation.
- **Treasure marker** (cylinder on `role: 'treasure'`) is positioned at
  `sampleFloorY(layout, room.x, room.z) + offset`, not `FLOOR_Y`, so the exit
  marker sits on the top tier floor.
- **`initScene`**: initial `camera.lookAt` uses spawn floor Y from
  `sampleFloorY(layout, spawnPos.x, spawnPos.z)` (fallback `DEFAULT_FLOOR_Y`),
  not hard-coded `y: 0`, so a bottom-tier spawn does not aim the camera
  underground.
- **Camera follow during ascent**: `updateCameraOrbit` (or equivalent per-frame
  camera update) tracks the local player's current Y (which the server sets from
  `sampleFloorY` during movement) — no code path resets camera target Y to
  `DEFAULT_FLOOR_Y` when `layout.profile === 'spire-ascent'`.
- Client unit test with a synthetic spire-ascent fixture (bottom tier low Y, top
  tier high Y, one ramp, top tier `role: 'treasure'`) asserts treasure marker
  mesh Y > bottom-tier floor Y and room mesh count matches tier + ramp count.
- Layouts without spire-ascent profile behave exactly as before (no regressions
  to sunken-canyon / open-plaza rendering).

## Technical Specs

- `game/client/dungeon.js`:
  - Confirm treasure-marker block already uses `sampleFloorY` (added for
    sunken-canyon); if not, apply the same pattern. No spire-specific branch
    should be needed if the generic path is correct.
  - Confirm the room loop calls `buildSlopedFloor` for non-uniform `floorCorners`
    (ramps need no new geometry path).
- `game/client/renderer.js`:
  - Confirm `initScene` passes sampled spawn floor Y to `camera.lookAt` (added
    for sunken-canyon).
  - Confirm `updateCameraOrbit` uses `playerY + CAMERA_HEIGHT` (or
    `sampleFloorY` fallback) without profile-specific flat-Y overrides.
- `game/client/test/dungeon.test.js`: add a `describe('spire-ascent floors &
  treasure marker')` block with a minimal fixture (2 tiers + 1 ramp, or a
  server-generated `generateLayout(42, 'spire-ascent')` import if the server
  module is reachable from client tests) asserting treasure marker Y and floor
  mesh count.

## Verification: code
