# Wire sampleFloorY into server movement handler

Replace the hardcoded `player.y = 0.5` in `applyPlayerMovement()` with a call to
`sampleFloorY(layout, x, z)` after each successful horizontal move, so the server
authoritatively tracks player elevation on sloped floors.

## Acceptance Criteria

- `applyPlayerMovement()` in `game/server/simulation.js` calls `sampleFloorY(state.layout, player.x, player.z)` after updating `player.x` / `player.z`.
- When `sampleFloorY` returns a finite number, `player.y` is set to that value.
- When `sampleFloorY` returns `null` (position outside all rooms, e.g. in a passage),
  `player.y` falls back to `DEFAULT_FLOOR_Y` (0.5) to avoid NaN or undefined.
- The existing horizontal collision logic (wall sliding, swept collision, bounds clamping)
  is unchanged — only the Y assignment differs from the previous `player.y = 0.5`.

## Technical Specs

- **File**: `game/server/simulation.js`
  - Add `sampleFloorY` and `DEFAULT_FLOOR_Y` to the existing `require('./dungeon')` import (or import directly from `../shared/floorSampling.js`).
  - In `applyPlayerMovement()`, replace `player.y = 0.5` (line ~305) with:
    ```js
    const floorY = sampleFloorY(_gameState.layout, player.x, player.z);
    player.y = Number.isFinite(floorY) ? floorY : DEFAULT_FLOOR_Y;
    ```

## Verification: code
