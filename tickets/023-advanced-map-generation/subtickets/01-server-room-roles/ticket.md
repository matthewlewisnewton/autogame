# Server Room Role Assignment

Add role metadata (`start`, `combat`, `treasure`) to every room in the generated layout. The assignment runs immediately after `generateLayout()` and uses the existing adjacency data to compute distances via BFS.

## Acceptance Criteria
- `assignRoomRoles(layout)` assigns a `role` string to every room in `layout.rooms`.
- Exactly one room receives `role: 'start'` — the first room (index 0) from layout generation.
- The room farthest from start (by BFS hop count) receives `role: 'treasure'`.
- All remaining rooms receive `role: 'combat'`.
- Each room gains additional metadata: `spawnWeight` (number) and `encounterTier` (number).
- `findFarthestRoom(layout, startRoom)` returns the room with the maximum BFS distance from the given start room.
- The layout remains deterministic for a given seed (role assignment does not introduce randomness).
- No existing room fields (`x`, `z`, `width`, `depth`, `walls`) are removed or renamed.

## Technical Specs
- **File:** `game/server/dungeon.js`
  - Add `buildAdjacencyMap(layout)` — returns `Map<roomIndex, Set<neighborIndex>>` from passages.
  - Add `bfsDistances(adjacencyMap, startIdx)` — returns `number[]` of hop distances.
  - Add `findFarthestRoom(layout, startRoom)` — uses BFS distance, returns the room object.
  - Add `assignRoomRoles(layout)` — mutates each room, adding `role`, `spawnWeight`, `encounterTier`.
    - `start`: spawnWeight 0, encounterTier 0
    - `combat`: spawnWeight 1, encounterTier based on BFS distance from start (distance / maxDistance, clamped 0–1)
    - `treasure`: spawnWeight 2, encounterTier 0
  - Call `assignRoomRoles(layout)` at the end of `generateLayout()` before returning.
  - Export all new functions.
- **File:** `game/server/index.js` — no changes needed; `generateLayout` now returns rooms with roles.

## Verification: code
