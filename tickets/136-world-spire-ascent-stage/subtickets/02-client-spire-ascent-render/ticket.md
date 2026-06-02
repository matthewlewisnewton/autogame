# Client: render Spire Ascent multi-tier geometry

Ensure the client correctly draws the `spire-ascent` layout from sub-ticket 01:
sloped ramp meshes between flat tiers, treasure marker and camera spawn aligned
to actual floor height at bottom and top, and dungeon bounds that encompass the
full vertical stack.

## Acceptance Criteria

- `buildDungeon(layout)` with `profile: 'spire-ascent'` renders one sloped or
  flat floor mesh per room (each tier + each ramp) via existing `buildSlopedFloor`
  / uniform-floor branches — no new geometry path required unless a regression
  is found.
- **Treasure marker** on the top-tier `role: 'treasure'` room uses
  `sampleFloorY(layout, room.x, room.z) + 0.75`, so the marker sits on the
  highest tier (Y well above `DEFAULT_FLOOR_Y`).
- **`initScene`**: initial `camera.lookAt` uses `sampleFloorY` at the spawn
  position (bottom tier), not a hard-coded flat `FLOOR_Y`.
- **`computeDungeonBounds`** (client and/or server) includes the full XZ extent
  of all tier and ramp rooms so the camera / minimap bounds do not clip the
  spire footprint (Y extent may remain unchanged if bounds are XZ-only).
- Client unit test in `game/client/test/dungeon.test.js` with a minimal
  spire-ascent-shaped fixture (bottom tier low Y, top tier high Y, one sloped
  ramp between) asserts: mesh count matches room count, treasure marker mesh Y ≥
  start tier floor Y + 8.
- Layouts without `profile: 'spire-ascent'` behave exactly as before.

## Technical Specs

- `game/client/dungeon.js`:
  - Confirm treasure-marker and wall-base paths already call `sampleFloorY`
    (fixed for sunken-canyon); no duplicate logic unless a spire-specific gap
    appears during implementation.
- `game/client/renderer.js`:
  - Confirm `initScene` spawn `lookAt` uses `sampleFloorY` (already present);
  - Confirm follow-camera `lookAt(playerX, playerY, playerZ)` tracks ascent via
    server `player.y` (ticket 117).
- `game/client/dungeon.js` — `computeDungeonBounds`: if the spire footprint
  exceeds current bounds logic, extend the reducer to union all room AABBs (tiers
  + ramps).
- `game/client/test/dungeon.test.js`: add a `spire-ascent` describe block with
  a synthetic three-room fixture (tier-0 flat at 0.5, ramp sloped 0.5→4.0,
  tier-2 flat at 4.0 with `role: 'treasure'`).

## Verification: code
