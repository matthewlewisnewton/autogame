# Fix Swept Collision — Trim Passage Wall Colliders

Server swept-collision validation rejects normal/evasive movement because passage-wall colliders span the full `CELL_SPACING` (20 units) and intrude into adjacent room interiors. Room sizes are 12–15 units (half-size 6–7.5), so the corridor between two rooms is only ~5–8 units. Passage walls of length 20 centered at the midpoint extend 2.5–4 units past the room edges, creating invisible collision blocks inside playable floor space.

Fix: trim passage-wall colliders to only cover the corridor gap between the two connected rooms, so that swept collision only blocks movement through actual walls and not through room interiors.

## Acceptance Criteria
- Passage-wall colliders in `buildWallColliders()` are trimmed so they do not extend past the edges of the connected rooms into playable floor space.
- Normal movement within a room is never rejected by swept collision.
- Movement through a passage gap between two connected rooms is never rejected.
- Movement that would pass through a room wall (not a gap) is still rejected.
- The integration test `moving out of range avoids damage` passes — the player's evasive moves are accepted, allowing them to exit enemy attack range.

## Technical Specs
- **File**: `game/server/dungeon.js` — In the passage-building step (Step 6), after computing `walls` for each passage, also compute the actual corridor length between the two connected rooms and store it on the passage object. The corridor length for a horizontal passage is `CELL_SPACING - fromRoomHalfWidth - toRoomHalfWidth` and for a vertical passage is `CELL_SPACING - fromRoomHalfDepth - toRoomHalfDepth`. Store as `corridorLength` on the passage object.
  - To get room half-dimensions, you need the room objects. Since passages are built from `cellPositions` (indices), you can look up the corresponding room from the `rooms` array by index. However, rooms are built in Step 5 and passages in Step 6 — so the rooms array is available when building passages. Use `rooms[p.from]` and `rooms[p.to]` to get `width/2` and `depth/2`.
  - Add `corridorLength` to each passage object returned from `generateLayout()`.
- **File**: `game/server/index.js` — In `buildWallColliders()`, for passage walls, use `corridorLength` instead of `CELL_SPACING` when building the wall AABB. Specifically, change the `wallAABB` call for passage walls to use the passage's `corridorLength` for the wall's length parameter.
  - Current code passes `wall.length` (which is `CELL_SPACING`) to `wallAABB`. Instead, pass `passage.corridorLength` for the length used in the AABB computation.
  - Simplest approach: in `buildWallColliders()`, when iterating `passage.walls`, override the length: instead of `wallAABB(wall, PASSAGE_WALL_THICKNESS / 2)`, use `wallAABB({ ...wall, length: passage.corridorLength }, PASSAGE_WALL_THICKNESS / 2)`.
- **No other files changed.** Do not modify client code, room wall generation, or enemy AI.

## Verification: code
