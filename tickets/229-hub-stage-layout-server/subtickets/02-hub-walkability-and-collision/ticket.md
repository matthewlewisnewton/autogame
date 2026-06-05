# Server: Hub layout walkability and collision

Confirm the `hub` profile produced in sub-ticket 01 has walkable geometry and
collision behaviour consistent with other bespoke stages (open-plaza,
sunken-canyon). Fix passage mouths or wall placement in `generateHub` only if
tests expose gaps.

## Acceptance Criteria

- For seeds `[1, 42, 123, 777, 9999]`, `generateLayout(seed, 'hub')` passes a
  foot-traffic flood from the **operations** (`start`) room through passages such
  that **every zone room** is reachable (`countReachableRooms` equals
  `layout.rooms.length`, using `computeWalkableAABBs` + `buildWallColliders` from
  `game/server/simulation.js` — same pattern as sunken-canyon / open-plaza tests).
- Every `boothAnchors` position is **walkable** for a player with radius 0.45 (use
  the existing `isWalkable` helper pattern from `dungeon.test.js`).
- No interior wall segment between connected zones is narrower than player
  diameter (~0.9 units) at passage centres (ramps/passages must not wedge).
- `sampleFloorY(layout, anchor.x, anchor.z)` returns `DEFAULT_FLOOR_Y` for each
  anchor (flat hub floor).
- `buildWallColliders(layout)` includes colliders for all room perimeter walls;
  anchors sit at least `PLAYER_RADIUS + 0.5` inside their zone AABB (not flush on
  a wall).
- Unit tests live in `game/server/test/dungeon.test.js` inside the hub `describe`
  block (extend sub-ticket 01 tests or add a nested `walkability` describe).

## Technical Specs

- `game/server/test/dungeon.test.js`:
  - Import / reuse `countReachableRooms`, `isWalkable`, `PLAYER_RADIUS` patterns
    from existing layout tests.
  - Add hub-specific reachability, anchor walkability, floor-Y, and wall-clearance
    cases listed above.
- `game/server/dungeon.js`:
  - **Only if required** to make tests pass: adjust `generateHub` wall gaps,
    passage alignment, or anchor insets. Do not change anchor key names or zone
    band assignments.

## Verification: code
