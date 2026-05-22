# Enemy Wall-Aware Movement

Replace the direct `enemy.x += dx / dist * move` mutations in `updateEnemies()` with calls to `moveEntityToward()`. Enemies must no longer pass through dungeon walls while chasing or wandering. When an enemy is blocked while wandering for multiple ticks, it picks a new wander target.

## Acceptance Criteria

- `updateEnemies()` uses `moveEntityToward(enemy, nearestPlayer, def.chaseSpeed * dt)` for chase movement instead of direct position mutation
- `updateEnemies()` uses `moveEntityToward(enemy, enemy.wanderTarget, def.wanderSpeed * dt)` for wander movement instead of direct position mutation
- When wander movement returns `blocked: true`, an `enemy.blockedTicks` counter is incremented; once it exceeds 10 ticks, a new `wanderTarget` is chosen via `randomWanderTarget()` and the counter is reset
- When wander movement is not blocked, `enemy.blockedTicks` is reset to 0
- Enemies never end a tick overlapping a wall collider
- If an enemy is blocked while chasing, it stops at the wall edge (does not teleport or snap through)
- Existing enemy detection radius (`DETECTION_RADIUS`), chase speed, wander speed, and attack behavior remain unchanged
- Unit tests verify: enemy stops at wall during chase, enemy picks new wander target after repeated blocks, blockedTicks resets on successful movement
- Integration test: place a player and enemy on opposite sides of a wall, tick enemy AI, and verify the enemy does not cross the wall

## Technical Specs

- **File**: `game/server/index.js` — modify the chase and wander movement blocks in `updateEnemies()` (around lines 1276–1310). Replace:
  ```js
  enemy.x += (dx / dist) * move;
  enemy.z += (dz / dist) * move;
  ```
  with `moveEntityToward()` calls. Add `blockedTicks` tracking for wander.
- **File**: `game/server/test/server.test.js` — unit tests for wall-aware enemy chase and wander
- **File**: `game/server/test/integration.test.js` — integration test for wall blocking

## Verification: code
