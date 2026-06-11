# Server test: dodge roll travels full distance on open floor

Add a server-side test in `game/server/test/dodge_roll.test.js` that verifies a dodge roll on open floor (no walls in the path) travels the **full configured dash distance** of 7.2 units. This is a regression / sanity check ensuring the collision pipeline does not inadvertently short-clamp legitimate movement.

## Acceptance Criteria

- `game/server/test/dodge_roll.test.js` contains a test that places a player in the center of a room with sufficient clearance in all directions, calls `tryPlayerMove()` with the full dodge dash distance (7.2 units) in a cardinal direction, and asserts:
  - `result.moved` is `true`
  - The displacement magnitude `Math.hypot(result.x - startX, result.z - startZ)` equals the dodge dash distance (7.2) within tolerance of 0.1
  - The final position is still inside the dungeon (`isInsideDungeon(result.x, result.z)` is `true`)
- All existing tests in `dodge_roll.test.js` and `simulation.test.js` continue to pass (`pnpm test` from `game/`).

## Technical Specs

- **File to change:** `game/server/test/dodge_roll.test.js`
- Use the existing `buildDashLayout()` helper (two rooms connected by passage) and `setupDashLayout()`, placing the player at `(0, 0)` in room A which has 12×12 clearance — a 7.2-unit dash from center lands well inside the room boundary
- Use existing `dodgeDashDistance()` helper for the distance value
- Test at least one cardinal direction (e.g., `(1, 0)` for +X / east)

## Verification: code
