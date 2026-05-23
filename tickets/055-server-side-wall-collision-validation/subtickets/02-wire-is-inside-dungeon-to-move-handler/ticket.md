# Wire `isInsideDungeon` into the Move Handler

## Description
Add `isInsideDungeon(newX, newZ)` as a final validation step in the server's `move` handler. After bounds clamping, wall collision resolution, and swept collision checks all pass, the resolved position must also be inside a valid room or passage — otherwise the move is rejected. This prevents hacked clients from reaching void positions between rooms.

## Acceptance Criteria
- [ ] `isInsideDungeon` is imported from `./simulation.js` in `index.js` (imported alongside `computeWalkableAABBs` in sub-ticket 01)
- [ ] The `move` handler calls `isInsideDungeon(newX, newZ)` after the swept collision `return` block and before `player.x = newX`
- [ ] When `isInsideDungeon(newX, newZ)` returns `false`, the handler returns early (player position is NOT updated)
- [ ] A `console.debug` log line is emitted on rejection (matching the style of the existing swept-collision rejection log)
- [ ] Existing `clampToDungeon`, `resolveWallCollision`, and `checkSweptCollision` logic remains unchanged (this is an additional guard, not a replacement)
- [ ] No syntax errors — `node -c game/server/index.js` succeeds

## Technical Specs
- **File**: `game/server/index.js`
  - In the `socket.on('move', ...)` handler, after the swept collision `return;` (around line 721) and before `player.x = newX` (around line 723), insert:
    ```js
    // Void check: reject moves into the space between rooms
    if (!isInsideDungeon(newX, newZ)) {
      console.debug(`Rejected move from ${socket.id}: position (${newX.toFixed(2)}, ${newZ.toFixed(2)}) is outside walkable dungeon area`);
      return;
    }
    ```
  - `isInsideDungeon` must already be imported from `./simulation.js` (wired in sub-ticket 01)

## Verification: code
