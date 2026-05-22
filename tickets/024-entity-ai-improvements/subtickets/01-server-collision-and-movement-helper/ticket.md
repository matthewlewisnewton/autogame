# Server Collision Constants and moveEntityToward Helper

Add an `ENTITY_RADIUS` constant and a `moveEntityToward()` helper that attempts to move an entity toward a target while respecting wall colliders and dungeon bounds. The helper includes axis-separated wall-slide when direct movement is blocked.

## Acceptance Criteria

- A new constant `ENTITY_RADIUS = 0.45` is exported from `game/server/index.js`.
- A new function `isEntityPositionBlocked(x, z, radius)` is added and exported:
  - Checks if a point position overlaps any wall collider (using `buildWallColliders` and entity radius)
  - Returns `true` when overlapping a wall, `false` otherwise
- A new function `moveEntityToward(entity, target, maxDistance, options)` is added and exported:
  - Computes normalized direction toward `target`
  - Returns `{ moved: false, blocked: false, reached: true }` without moving if entity is already within `stopDistance` (default 0.1) of target
  - Applies at most `maxDistance` of movement
  - First attempts direct movement; if the proposed position overlaps a wall collider, falls back to axis-separated movement (try X-only, then Z-only, pick whichever works)
  - Clamps the final position to `gameState.dungeonBounds`
  - Assigns `entity.x` and `entity.z` only to the validated final position
  - Returns `{ moved, blocked, reached }` metadata
  - Uses `options.radius` (default `ENTITY_RADIUS`) and `options.stopDistance` (default 0.1)
  - Is deterministic — no timers, randomness, or socket emissions
- `resetGameState()` continues to refresh collision data (it already regenerates `gameState.layout`, so `buildWallColliders()` returns fresh colliders on each call — no additional change needed)
- Unit tests cover: open-space movement, wall blocking, wall-slide on one axis, bounds clamping, stop-distance early return, and blocked metadata

## Technical Specs

- **File**: `game/server/index.js` — add `ENTITY_RADIUS`, `isEntityPositionBlocked()`, `moveEntityToward()`
- **File**: `game/server/test/server.test.js` — unit tests for the new functions
- Use existing `buildWallColliders()` and `wallAABB()` for collider generation (already exported, already tested by other tickets)
- The AABB overlap check in `isEntityPositionBlocked` should expand the collider by `radius` on each axis (same pattern as `checkWallCollision`)

## Verification: code
