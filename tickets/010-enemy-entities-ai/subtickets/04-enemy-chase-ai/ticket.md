# Enemy Chase AI

When a player enters an enemy's detection radius, the enemy switches from `'idle'` to `'chasing'` and moves directly toward the nearest player. If all players move beyond the detection radius, the enemy returns to `'idle'` and resumes wandering.

## Acceptance Criteria
- Each enemy has a detection radius (≈8 units); when any player is within that distance, the enemy's `state` becomes `'chasing'`
- A chasing enemy moves toward the nearest player each tick at a chase speed faster than wander (≈2.5 units/sec)
- When no player is within the detection radius, the enemy's `state` reverts to `'idle'` and it resumes wandering
- The nearest-player calculation uses Euclidean distance on the x-z plane

## Technical Specs
- **File**: `game/server/index.js`
- Define constants `DETECTION_RADIUS = 8` and `CHASE_SPEED = 2.5`
- In `updateEnemies()` (the same loop from sub-ticket 03), for each enemy:
  - Compute distance to every live player in `gameState.players`; track the nearest
  - If nearest player distance < `DETECTION_RADIUS`, set `enemy.state = 'chasing'` and move enemy toward that player at `CHASE_SPEED / TICK_RATE` per tick
  - If no player is within `DETECTION_RADIUS`, set `enemy.state = 'idle'` (falls through to wander logic)
- Skip dead players (`player.dead === true`) in the nearest-player search

## Verification: code
