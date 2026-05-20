# Server Movement Validation — Elapsed Cap and Swept Collision

A malicious or sparse client can exploit the current elapsed-time movement model in two ways: (1) waiting a long time before sending a `move` intent accumulates a huge time delta, allowing a single teleport across the dungeon; (2) the server only checks wall collision at the final position, so a large step can tunnel through a wall if the endpoint happens to be clear. Cap the per-request elapsed time and validate the swept path between the previous and proposed position.

## Acceptance Criteria
- The server caps `elapsed` to a maximum of `MAX_ELAPSED_MS / 1000` (e.g., 200 ms) so that a client that waits cannot accumulate unlimited movement distance in a single request.
- The server performs **swept collision** along the segment from `(player.x, player.z)` to `(newX, newZ)` — if any point along the path intersects a wall, the move is rejected (or clamped to the wall edge).
- A move that would tunnel through a thin wall is rejected even if the final position is in open space.
- Normal movement (small steps at TICK_RATE frequency) is unaffected — accepted with the same result as before.
- `MAX_MOVE_DISTANCE_PER_TICK` is removed from imports (currently unused after the intent-protocol change).

## Technical Specs
- **File**: `game/server/index.js` — In the `socket.on('move', ...)` handler:
  1. After computing `elapsed`, cap it: `const maxElapsed = MAX_ELAPSED_MS / 1000; const cappedElapsed = Math.min(elapsed, maxElapsed);` — use `cappedElapsed` for all subsequent distance calculations instead of `elapsed`.
  2. After computing `newX`, `newZ` (before wall collision), replace the single-point `checkWallCollision(newX, newZ)` with a swept check. Add a new helper `checkSweptCollision(fromX, fromZ, toX, toZ)` that casts a ray from the previous position to the new position and checks intersection with every wall AABB. A simple approach: for each wall, check if the line segment intersects the AABB (using slab method or separating axis). If any wall is intersected, reject the move.
  3. Update `player.lastMoveTime = now` only on accepted moves (already the case — keep this).
- **File**: `game/server/config.js` — Add `const MAX_ELAPSED_MS = 200;` (maximum milliseconds of movement granted per request). Remove `MAX_MOVE_DISTANCE_PER_TICK` (no longer imported/used anywhere).
- **No other files changed.** Do not modify client files, tests, dungeon generation, or enemy AI.

## Verification: code
