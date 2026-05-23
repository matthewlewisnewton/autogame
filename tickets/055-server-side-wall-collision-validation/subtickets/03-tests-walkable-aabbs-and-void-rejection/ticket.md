# Add Automated Tests for Walkable AABBs and Void-Move Rejection

## Description
Add focused unit tests for `computeWalkableAABBs()` and `isInsideDungeon()` in `simulation.js`, plus an integration test that verifies the `move` handler rejects positions in the void between rooms. These tests serve as regression coverage for the server-side wall collision validation and replace the need for a manual "disable client wall collision" verification step.

## Acceptance Criteria
- [ ] Unit tests exist for `computeWalkableAABBs(layout)` — verify it returns one AABB per room and one per passage, with correct min/max bounds derived from room dimensions and `PASSAGE_WIDTH`
- [ ] Unit tests exist for `isInsideDungeon(x, z)` — verify it returns `true` for positions inside a room, `true` for positions inside a passage, and `false` for positions in the void between rooms
- [ ] Unit test for defensive behavior: `isInsideDungeon` returns `false` when `gameState.walkableAABBs` is unset or empty
- [ ] Integration test (or socket-level test) that simulates a `move` emit to a void position and verifies the server does NOT update the player's position (and emits a rejection or leaves position unchanged)
- [ ] All existing tests continue to pass (`pnpm run test` from `game/` succeeds with zero failures)

## Technical Specs
- **File**: `game/server/simulation.test.js` (or create if not existing)
  - Import `computeWalkableAABBs`, `isInsideDungeon` from `./simulation`
  - Construct a minimal mock `layout` with 2 rooms and 1 passage; test AABB count, room AABB bounds, passage AABB bounds
  - Mock `_gameState.walkableAABBs` (or use the test export from `index.js`) to test `isInsideDungeon` with known inside/void coordinates
- **File**: `game/server/index.test.js` (or existing integration test file under `game/server/`)
  - Use the existing socket test harness to emit a `move` event targeting a void coordinate between rooms
  - Assert that `player.x` / `player.z` remain unchanged after the move attempt
- Follow existing test patterns in the project (vitest, describe/it blocks, same assertion library)

## Verification: code
