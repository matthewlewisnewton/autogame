# Client: render Spire Ascent multi-tier geometry

Make the client correctly draw the spire-ascent layout from sub-ticket 01:
sloped ramps and flat tier platforms at increasing Y, treasure marker on the top
tier, and camera initialization that respects spawn floor height so ascent does
not aim underground.

## Acceptance Criteria

- `buildDungeon(layout)` with `profile: 'spire-ascent'` renders one sloped or
  flat floor mesh per room (each tier and each ramp) via existing
  `buildSlopedFloor` / uniform-floor branches — no extra geometry path required
  beyond correct `floorCorners`.
- **Treasure marker** (`role: 'treasure'`) uses
  `(sampleFloorY(layout, room.x, room.z) ?? DEFAULT_FLOOR_Y) + 0.75`, not
  hard-coded `FLOOR_Y`, so the exit marker sits on the **top tier** floor.
- **`initScene`**: initial `camera.position.y` and `camera.lookAt` both use
  spawn floor Y from `sampleFloorY(layout, spawnPos.x, spawnPos.z)` (fallback
  `DEFAULT_FLOOR_Y`): position at `spawnFloorY + CAMERA_HEIGHT`, look-at at
  `(spawnX, spawnFloorY, spawnZ)` — not `CAMERA_HEIGHT` / `y: 0` alone.
- Wall meshes on sloped tier/ramp rooms use `sampleFloorY` for base Y (existing
  path); no regression for default/crowded layouts.
- Client unit test in `game/client/test/dungeon.test.js`: minimal spire-ascent
  fixture (two tiers, one ramp, top `treasure`) asserts treasure marker mesh Y >
  bottom tier floor Y; optional test with `generateLayout(42, 'spire-ascent')`
  asserts mesh count matches room count and top-tier treasure Y ≥ spawn floor Y
  + 8.
- Layouts without `spire-ascent` profile behave exactly as before.

## Technical Specs

- `game/client/dungeon.js`:
  - Confirm treasure-marker block already uses `sampleFloorY` (from canyon work);
  - if any branch still uses `FLOOR_Y` for treasure, switch to `sampleFloorY`.
  - Confirm room loop calls `buildSlopedFloor` for non-uniform `floorCorners`
    (ramps and any sloped tier edges).
- `game/client/renderer.js`:
  - In `initScene`, after `spawnPos` is set, compute `spawnFloorY =
    sampleFloorY(layout, spawnPosition.x, spawnPosition.z) ?? DEFAULT_FLOOR_Y`.
  - Set `camera.position` to
    `(spawnX + sin(yaw)*dist, spawnFloorY + CAMERA_HEIGHT, spawnZ + cos(yaw)*dist)`
    and `camera.lookAt(spawnX, spawnFloorY, spawnZ)`.
- `game/client/test/dungeon.test.js`: add `describe('spire-ascent floors &
  treasure marker')` with synthetic layout and server-generated layout case.

## Verification: code
