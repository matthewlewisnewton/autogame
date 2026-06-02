# Client: render Spire Ascent multi-tier geometry

Make the client correctly draw the spire-ascent layout from sub-ticket 01:
sloped ramps and flat tier platforms at distinct elevations; treasure marker and
initial camera aim aligned to actual floor height (not flat `FLOOR_Y`).

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
- **Camera follow during play** uses the local player's floor-sampled Y (or
  server `player.y`) so ascending tiers do not leave the avatar visibly below
  the floor mesh for normal movement (no regression vs sunken-canyon / sloped
  dungeon behaviour).
- Add/extend a client unit test with a synthetic spire-ascent fixture (bottom
  tier low corners, top tier high corners, one ramp, top tier `role:
  'treasure'`) asserting treasure marker mesh Y > `DEFAULT_FLOOR_Y` and tier
  floor mesh elevations increase with `tierIndex`.
- Layouts without `spire-ascent` profile behave exactly as before.

## Technical Specs

- `game/client/dungeon.js`:
  - Confirm the treasure-marker block already uses `sampleFloorY` (added for
    sunken-canyon); if not, replace `0.75 + FLOOR_Y` with
    `(sampleFloorY(layout, room.x, room.z) ?? DEFAULT_FLOOR_Y) + 0.75`.
  - Confirm the room loop calls `buildSlopedFloor` for non-uniform
    `floorCorners` on ramp rooms and flat tiers need no new geometry path.
- `game/client/renderer.js`:
  - Confirm `initScene` uses `sampleFloorY` at spawn for `camera.lookAt` (same
    as sunken-canyon fix); adjust only if spire-ascent exposes a gap.
  - Confirm the per-frame camera follow path uses floor-sampled or synced
    `player.y` when layout has sloped rooms (see `updateLocalPlayer` /
    `camera.position` lerp block).
- `game/client/test/dungeon.test.js`: add a describe block with a minimal
  spire-ascent fixture (tier-0 low, tier-1 high, one ramp, top `role:
  'treasure'`) and assert treasure marker Y and tier floor mesh Y ordering;
  optional integration test calling `generateLayout(42, 'spire-ascent')`.
- `game/server/dungeon.js`: export `generateSpireAscent` only if the client
  test imports server layout (same pattern as sunken-canyon server-generated
  test).

## Verification: code
