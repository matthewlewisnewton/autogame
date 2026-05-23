# Implement `computeWalkableAABBs` and `isInsideDungeon`

## Description
Add server-side functions to compute walkable area bounding boxes from the dungeon layout and check if a point is inside any walkable area. These functions replace the existing `clampToDungeon` (which only checks the outer bounding box) with a more precise check that rejects positions in the void between rooms.

## Acceptance Criteria
- [ ] `computeWalkableAABBs(layout)` exists in `simulation.js` and returns an array of `{ minX, maxX, minZ, maxZ }` objects — one per room (using `room.x ± width/2`, `room.z ± depth/2`) and one per passage (bounding box from `p.x1/p.z1` to `p.x2/p.z2` expanded by `PASSAGE_WIDTH / 2`)
- [ ] `isInsideDungeon(x, z)` exists in `simulation.js` and returns `true` when `(x, z)` is inside at least one walkable AABB on `gameState.walkableAABBs`, `false` otherwise (defensive: returns `false` when `walkableAABBs` is unset or empty)
- [ ] `gameState.walkableAABBs` is populated at startup (after `gameState.dungeonBounds = computeDungeonBounds(...)`) and re-computed in `resetGameState()`
- [ ] Both functions are exported from `simulation.js` (in `module.exports`) and imported + re-exported from `index.js` (in the test-exports block)
- [ ] `PASSAGE_WIDTH` is imported from `./dungeon` in `simulation.js` (used for passage AABB expansion)
- [ ] No syntax errors — `node -c game/server/simulation.js` and `node -c game/server/index.js` succeed

## Technical Specs
- **File**: `game/server/simulation.js`
  - Import `PASSAGE_WIDTH` from `./dungeon` (near top, alongside existing `require('./config')`)
  - Add `computeWalkableAABBs(layout)` — iterates `layout.rooms` then `layout.passages`, builds AABB array. Guard against missing `layout.rooms` / `layout.passages`
  - Add `isInsideDungeon(x, z)` — point-in-AABB check against `_gameState.walkableAABBs` (guard against undefined/empty; return `false` when unset)
  - Add both to `module.exports` (under the "Dungeon position helpers" section, alongside `computeDungeonBounds`)
- **File**: `game/server/index.js`
  - Import `computeWalkableAABBs` and `isInsideDungeon` from `./simulation.js` (in the existing import block around line 94)
  - After each existing line `gameState.dungeonBounds = computeDungeonBounds(gameState.layout)` (at init and in `resetGameState`), add `gameState.walkableAABBs = computeWalkableAABBs(gameState.layout)`
  - Re-export both in the test-exports block (near `firstRoomPosition`, `createGameState`)

## Verification: code
