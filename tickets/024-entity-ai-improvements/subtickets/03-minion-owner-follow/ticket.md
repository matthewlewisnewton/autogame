# Minion Owner-Follow and Wall-Aware Movement

Make minions use `moveEntityToward()` when chasing enemies, and add owner-follow behavior when no enemy is nearby. Minions respect wall collision in both chase and follow modes.

## Acceptance Criteria

- `updateMinions()` uses `moveEntityToward(minion, nearestEnemy, ENEMY_DEFS.grunt.chaseSpeed * dt)` for chase movement instead of direct position mutation
- Constants `MINION_FOLLOW_DISTANCE = 3` and `MINION_FOLLOW_SPEED` (equal to `CHASE_SPEED` from config, i.e. `ENEMY_DEFS.grunt.chaseSpeed`) are defined and exported
- When no enemy is within `DETECTION_RADIUS`, a living minion follows its owner:
  - Looks up `gameState.players[minion.ownerId]`
  - If the owner is missing, disconnected, or dead, the minion stays stationary
  - If the minion is within `MINION_FOLLOW_DISTANCE` of the owner, it stays put
  - Otherwise, calls `moveEntityToward(minion, owner, MINION_FOLLOW_SPEED * dt, { stopDistance: MINION_FOLLOW_DISTANCE })`
- Minions respect wall collision while following (via `moveEntityToward`)
- Existing minion TTL, HP cleanup, and attack behavior continue to work unchanged
- Unit tests verify: minion follows a living owner, minion does not follow a dead/missing owner, minion stays put when within follow distance, minion prioritizes enemy over owner
- Integration test: place a minion far from its owner with no enemies, tick minion AI, verify the minion moves closer to the owner

## Technical Specs

- **File**: `game/server/index.js` — modify the minion chase block in `updateMinions()` (around lines 1348–1358) to use `moveEntityToward()`. Add owner-follow logic in the `else` branch where minions currently remain stationary. Add `MINION_FOLLOW_DISTANCE` and `MINION_FOLLOW_SPEED` constants near the top of the file.
- **File**: `game/server/test/server.test.js` — unit tests for minion follow behavior and wall collision
- **File**: `game/server/test/integration.test.js` — integration test for minion owner-follow

## Verification: code
