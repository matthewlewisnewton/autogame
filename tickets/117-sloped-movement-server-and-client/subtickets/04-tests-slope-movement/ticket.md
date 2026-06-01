# Integration & regression tests for slope movement

Add tests that verify `player.y` changes correctly when moving across sloped
floors, and ensure existing wall collision / bounds logic is not broken.

## Acceptance Criteria

- A new test creates a layout fixture with at least one sloped room
  (`floorCorners` with varying Y values) and one flat room, connected by a passage.
- The test calls `applyPlayerMovement()` with input directing the player across
  the sloped room and asserts that `player.y` increases (or decreases) in the
  expected direction proportional to horizontal displacement.
- The test verifies that when `sampleFloorY` returns `null` (player in a passage
  between rooms), `player.y` falls back to `DEFAULT_FLOOR_Y` (0.5).
- Existing tests in `applyPlayerMovement.test.js` continue to pass (horizontal
  movement, analog input, stale input, rotation-only packets, persistence flush).
- A regression test confirms that `tryPlayerMove` wall-sliding behavior is
  unchanged on a layout with slopes enabled.

## Technical Specs

- **File**: `game/server/test/applyPlayerMovement.test.js` (add new tests to existing file)
- Add a helper `buildSlopedLayout()` that returns a layout with:
  - A flat room at origin (all `floorCorners` = 0.5)
  - A sloped room to the south (NW/NE = 0.5, SE/SW = 2.0)
  - A passage connecting them
- New test cases:
  - `'sets player.y from sampleFloorY when moving on a ramp'` — place player
    in flat room, move toward sloped room; after entering the sloped room,
    assert `player.y > 0.5` and increases as player moves southward.
  - `'falls back to DEFAULT_FLOOR_Y when sampleFloorY returns null'` — place
    player in a passage (outside all room AABBs); assert `player.y === 0.5`.
  - `'wall sliding works on sloped rooms'` — place player near a wall inside
    a sloped room and move parallel to the wall; assert XZ sliding still works
    and Y is correctly sampled.
- Run `pnpm test` to verify all existing tests still pass.

## Verification: code
