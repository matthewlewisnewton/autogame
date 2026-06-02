# Client: Sunken Canyon camera follow and plateau vista

Ensure the existing third-person camera tracks the player across the plateau, ramps,
and canyon floor without floor clipping, and that the plateau spawn offers a clear
view down into the canyon (no wall mesh blocking the vista).

## Acceptance Criteria

- With quest `sunken_canyon` loaded, local player mesh Y follows `sampleFloorY` on
  the plateau, each ramp, and the canyon floor (no sustained “floating” or “sunk
  below floor” offset beyond normal interpolation tolerance).
- `updateCameraOrbit` uses `playerY + CAMERA_HEIGHT` while on sunken-canyon ramps and
  both bands — camera does not stick at `DEFAULT_FLOOR_Y` when the player has
  descended ≥ 4 units.
- From the default plateau spawn, without moving, the camera frustum includes a
  substantial portion of the canyon floor mesh (vista check): no full-height north/
  south plateau wall segment blocks the line from camera to canyon center.
- Remote player meshes use server `y` on slopes (unchanged behavior; regression only).
- No new gameplay systems — layout parapet/low walls from sub-ticket 01 should do
  most vista work; this ticket only adjusts client rendering if walls still occlude
  (e.g. skip rendering vista parapet meshes, or lower `WALL_HEIGHT` for tagged walls
  in `buildDungeon` when `layout.profile === 'sunken-canyon'` and wall has
  `parapet: true`).
- Unit or integration test where feasible: synthetic sunken-canyon layout with
  parapet-tagged wall produces shorter box geometry than standard walls; camera
  target Y test uses elevated `playerY`.

## Technical Specs

- `game/client/dungeon.js` — in room wall mesh construction, honor optional
  `wall.parapet` or `wall.height` override for sunken-canyon vista segments.
- `game/client/renderer.js` — verify `updateCameraOrbit` receives interpolated
  local `playerY` from movement prediction / server sync on sloped floors; fix only
  if sunken-canyon exposes a stale-Y bug.
- `game/client/test/dungeon.test.js` — assert parapet wall mesh height < standard
  `WALL_HEIGHT` for tagged walls.
- Depends on sub-tickets **01** (layout + quest) and **03** (spawn scenario) for
  in-game verification via `sunken-canyon-stage` or deploying `sunken_canyon`.

## Verification: code
