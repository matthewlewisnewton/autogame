# Server: Minion AI — Chase and Attack Enemies

Minions are AI-controlled: each tick they seek the nearest enemy and chase it using the same chase logic as enemies (reuse `CHASE_SPEED` and `DETECTION_RADIUS` constants). When a minion reaches an enemy within `ATTACK_RANGE`, it deals damage each tick.

## Acceptance Criteria
- Each game tick, every living minion finds the nearest enemy in `gameState.enemies`
- If an enemy is within `DETECTION_RADIUS` (8 units), the minion moves toward it at `CHASE_SPEED` (2.5 units/s)
- If the minion is within `ATTACK_RANGE` (5 units) of an enemy, it deals 5 damage per tick to that enemy
- Dead enemies removed by minion damage are filtered from `gameState.enemies` (same pattern as existing enemy removal)
- Minions with no enemy in range remain stationary (do not wander)

## Technical Specs
- **File**: `game/server/index.js`
- Inside the `updateMinions()` function created in sub-ticket 01, add AI logic before the ttl/hp cleanup:
  - For each minion, iterate `gameState.enemies` to find the nearest (Euclidean distance on x-z plane)
  - If `nearestDist < DETECTION_RADIUS`, move minion toward enemy:
    ```
    const move = CHASE_SPEED * dt;
    minion.x += (dx / dist) * move;
    minion.z += (dz / dist) * move;
    ```
  - If `nearestDist <= ATTACK_RANGE`, apply damage:
    ```
    enemy.hp -= 5;
    ```
  - After damage, filter dead enemies: `gameState.enemies = gameState.enemies.filter(e => e.hp > 0)`
- Reuse existing constants `CHASE_SPEED`, `DETECTION_RADIUS`, `ATTACK_RANGE` — do not introduce new ones

## Verification: code
