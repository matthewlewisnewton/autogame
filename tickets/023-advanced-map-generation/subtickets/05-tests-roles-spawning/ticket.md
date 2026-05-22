# Tests for Role Assignment and Spawning

Add unit tests verifying that room role assignment is correct, deterministic, and that role-aware spawning respects the intended constraints.

## Acceptance Criteria
- Test: `assignRoomRoles` is deterministic — two calls with the same layout produce identical role assignments.
- Test: exactly one room has `role: 'start'`.
- Test: at least one room has `role: 'combat'` (when layout has >1 room).
- Test: exactly one room has `role: 'treasure'` (when layout has >1 room).
- Test: the start room is `layout.rooms[0]`.
- Test: the treasure room is the farthest from start by BFS distance.
- Test: `roomsByRole` returns correct rooms for each role.
- Test: `randomRoomPositionByRole` returns a position within a room of the requested role.
- Test: enemy spawning excludes the start room when combat rooms exist.
- Test: loot spawning prefers treasure room when one exists.
- Test: all rooms remain reachable (BFS connectivity) after role assignment.
- All tests pass with `pnpm run test` (server test suite).

## Technical Specs
- **File:** `game/server/test/dungeon.test.js`
  - Add describe block `'room roles'` with tests for:
    - `assignRoomRoles` determinism (same seed → same roles)
    - exactly one start room
    - start room is rooms[0]
    - treasure room is farthest from start
    - at least one combat room
    - `roomsByRole` returns correct counts
    - `randomRoomPositionByRole` returns position in correct role
    - all rooms have `role`, `spawnWeight`, `encounterTier` fields
    - BFS connectivity preserved after role assignment
- **File:** `game/server/test/server.test.js`
  - Add tests for:
    - `firstRoomPosition` returns start room center
    - enemy spawn positions exclude start room (when combat rooms exist)
    - loot spawn positions prefer treasure room
- Use existing test helpers (`resetState`, `addPlayer`) and patterns.

## Verification: code
