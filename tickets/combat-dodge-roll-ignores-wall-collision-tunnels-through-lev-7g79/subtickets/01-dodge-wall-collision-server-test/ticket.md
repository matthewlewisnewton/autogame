# Server test: dodge roll blocked by wall segment

Add a server-side test in `game/server/test/dodge_roll.test.js` that verifies the dodge roll's `tryPlayerMove` call respects wall collision at the **full dodge distance** (7.2 units). The existing test uses a shortened distance (3.5 units) — the new test must use the actual `dodgeDashDistance()` value and confirm the player stops at the wall boundary without tunneling through.

## Acceptance Criteria

- `game/server/test/dodge_roll.test.js` contains a test that places a player inside a room with explicit walls, calls `tryPlayerMove()` with the full dodge dash distance (7.2 units) directly toward a wall, and asserts:
  - `result.moved` is `true` (player slides to the wall edge) OR `result.moved` is `false` (player is fully blocked — both are acceptable as long as the player does NOT end up past the wall)
  - The final player position is on the room-interior side of the wall (i.e., `result.x + PLAYER_RADIUS <= wallMinX + 0.01` for an east wall, or equivalent for other axes)
  - The player does NOT end up outside the room's walkable AABB
- A second variant tests a player pinned flush against a wall (e.g., at the room's north edge) who dodges straight into the wall — the test asserts `result.moved` is `false` and position is unchanged.
- All existing tests in `dodge_roll.test.js` and `simulation.test.js` continue to pass (`pnpm test` from `game/`).

## Technical Specs

- **File to change:** `game/server/test/dodge_roll.test.js`
- Use the existing `buildSmallRoom()` helper (12×12 room with 4 walls) and `setupRoom()` to create the layout
- Use existing `dodgeDashDistance()` helper to compute the real 7.2-unit dash distance
- Import `getWallColliders` and `rebuildWallColliders` from `../index.js` if needed to force collider rebuild after layout change (the existing `setupRoom` sets `gameState.layout` which `getWallColliders()` reads via its cache invalidation)
- Test the "pinned against wall" scenario by placing the player at a position very close to the wall inner edge (e.g., `z = -5.3` for the north wall at `z = -6`) and dodging with direction `(0, -1)` (toward −Z / north)

## Verification: code
