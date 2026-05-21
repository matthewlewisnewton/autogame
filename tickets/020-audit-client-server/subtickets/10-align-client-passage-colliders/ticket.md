# Align Client Passage Colliders with Server Corridor Trimming

The server trims passage-wall colliders using `corridorLength` (the actual gap between connected rooms) so that swept-collision checks only block movement through the corridor walls, not into room interiors. The client builds its wall colliders from the raw `wall.length` values on passage walls, which equal `CELL_SPACING = 20` — far larger than the actual corridor. This causes the client's local collision resolution to push the player back at false boundaries inside room space, while the server accepts the move, resulting in a snap-back correction.

Fix: have the client use `passage.corridorLength` (already present on each passage object in the layout) when building passage-wall AABB colliders, matching the server's `buildWallColliders()` behavior.

## Acceptance Criteria
- The client's `buildWallColliders()` function uses `passage.corridorLength` instead of `wall.length` when building AABB colliders for passage walls, matching the server's approach.
- Room-wall colliders are unchanged — they still use the full `wall.length` from the room wall objects.
- Client-side local collision resolution during movement no longer produces false push-backs inside room interiors near passage gaps.
- The integration test `moving out of range avoids damage` still passes (player can move through passages without being blocked by oversized colliders).

## Technical Specs
- **File**: `game/client/dungeon.js` — In `buildWallColliders()`, for passage walls, override the wall length with `passage.corridorLength` before calling `wallAABB`:
  ```js
  for (const passage of layout.passages) {
    for (const wall of passage.walls) {
      colliders.push(wallAABB({ ...wall, length: passage.corridorLength }, PASSAGE_WALL_THICKNESS / 2));
    }
  }
  ```
  This mirrors the exact same fix already applied on the server in `game/server/index.js`.
- **No other files changed.** Do not modify server code, room-wall colliders, or test files.

## Verification: code
