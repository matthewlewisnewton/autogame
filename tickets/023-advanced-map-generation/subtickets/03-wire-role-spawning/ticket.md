# Wire Role-Aware Spawning

Replace the uniform random room spawning with role-aware placement: players spawn in the start room, enemies prefer combat rooms (never the start room), and loot prefers treasure rooms.

## Acceptance Criteria
- Player spawn position uses the `start` room exclusively (via `firstRoomPosition` or equivalent).
- Enemy spawning uses combat rooms preferentially — when combat rooms exist, enemies never spawn in the start room.
- Loot/reward spawning uses treasure rooms preferentially — when a treasure room exists, loot spawns there.
- Existing `spawnEnemies()` logic is updated to use role-aware placement.
- Existing `spawnLoot()` logic is updated to use role-aware placement.
- All spawned entities land in valid reachable positions (within room bounds, not in walls).
- The change does not alter the number of enemies or loot items spawned.

## Technical Specs
- **File:** `game/server/index.js`
  - Update `firstRoomPosition()` to find the room with `role: 'start'` and return its center. If no start room exists (defensive), fall back to `layout.rooms[0]`.
  - Update `spawnEnemies()` to use `randomRoomPositionByRole(layout, 'combat', rng)` for enemy placement. If no combat rooms, fall back to any non-start room. As a last resort, any room.
  - Update `spawnLoot()` to use `randomRoomPositionByRole(layout, 'treasure', rng)` for loot placement. If no treasure room, fall back to any non-start room.
  - Import `roomsByRole`, `randomRoomPositionByRole` from `dungeon.js` (already exported by `index.js` re-exports).
- **File:** `game/server/dungeon.js` — no changes needed (helpers added in sub-ticket 02).

## Verification: code
