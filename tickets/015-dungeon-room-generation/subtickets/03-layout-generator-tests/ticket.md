# Layout Generator Unit Tests

Add comprehensive unit tests for `generateLayout()` in `game/server/dungeon.js` to verify determinism, room count, graph connectivity, wall gap correctness, and passage geometry.

## Acceptance Criteria
- Test: `generateLayout(seed)` with the same seed returns identical `rooms` and `passages` arrays (deep equality)
- Test: `generateLayout(seed)` with different seeds produces different layouts
- Test: every layout has at least 4 rooms
- Test: the room graph is fully connected (BFS/DFS from room 0 reaches all rooms)
- Test: rooms with passage connections have wall gaps on the correct sides
- Test: passage objects have boundary walls on both sides
- Test: `mulberry32(seed)` produces a deterministic sequence of values
- All tests pass with `npm test`

## Technical Specs
- **New file**: `game/server/test/dungeon.test.js` — unit tests for `mulberry32` and `generateLayout` from `game/server/dungeon.js`
- Tests use `vitest` (same framework as existing tests in the project)
- Connectivity test: build adjacency list from passages, run BFS from room 0, assert all rooms visited
- Wall gap test: for each passage between rooms A and B, verify that room A has a gap on the side facing B (i.e., fewer wall segments on that side than a solid wall)

## Verification: code
