# Client: render Spire Ascent multi-tier geometry

Make the client correctly draw the spire-ascent layout from sub-ticket 01:
sloped ramp meshes between flat tier platforms, perimeter walls at sampled
floor height, and treasure marker / spawn camera aimed at actual floor Y (not
flat `FLOOR_Y`).

## Acceptance Criteria

- `buildDungeon(layout)` with `profile: 'spire-ascent'` renders one sloped or
  flat floor mesh per room (each tier + each ramp) via existing
  `buildSlopedFloor` / uniform-floor branches — no new geometry type required.
- **Treasure marker** on `role: 'treasure'` (top tier) uses
  `(sampleFloorY(layout, room.x, room.z) ?? DEFAULT_FLOOR_Y) + 0.75`, so the
  exit marker sits on the highest tier, not at `DEFAULT_FLOOR_Y`.
- **`initScene`**: `camera.lookAt` uses spawn floor Y from `sampleFloorY` at
  the start tier (already required for canyon; confirm it works when spawn Y ≥
  bottom tier height).
- **Player mesh Y** during play continues to use `sampleFloorY` at
  `(myX, myZ)` (existing path) so ascending ramps raises the avatar; add or
  extend a unit test with a synthetic spire layout (bottom tier at Y=0.5, top
  tier at Y≥10.5, one ramp) asserting treasure marker Y > `DEFAULT_FLOOR_Y` +
  9 and ramp room produces non-uniform sloped floor mesh.
- Layouts without `spire-ascent` profile behave exactly as before.
- Optional: if initial `camera.position` Y ignores spawn elevation, set the
  first frame’s camera height to `spawnFloorY + CAMERA_HEIGHT` (same fix pattern
  as sunken-canyon QA).

## Technical Specs

- `game/client/dungeon.js`:
  - Confirm treasure-marker block already uses `sampleFloorY` (canyon fix); no
    regression for spire top tier.
  - Confirm room loop uses `buildSlopedFloor` for ramp `floorCorners` and flat
    mesh for uniform tier corners.
- `game/client/renderer.js`:
  - Confirm `initScene` passes `spawnFloorY` into `camera.lookAt`.
  - If needed, offset initial `camera.position.y` by `spawnFloorY` so a
    bottom-tier spawn does not frame the camera underground relative to the
    player mesh.
- `game/client/test/dungeon.test.js`: add `describe('spire-ascent …')` with a
  minimal fixture (2 tiers + 1 ramp + top `treasure` room) and assert treasure
  marker mesh Y and sloped ramp floor vertex count / mesh type.

## Verification: code
