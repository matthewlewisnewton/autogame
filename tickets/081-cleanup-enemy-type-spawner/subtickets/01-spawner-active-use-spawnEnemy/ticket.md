# Use spawnEnemy() in spawner-active debug scenario

Replace the hand-built spawner literal in the `spawner-active` debug scenario with a call to the shared `spawnEnemy()` helper, then mutate `lastSpawnTime` on the returned enemy to backdate it. This eliminates drift between enemy construction and future enemy-init changes.

## Acceptance Criteria
- `spawner-active` constructs the spawner via `spawnEnemy(x, z, 'spawner')` instead of a manual object literal.
- After calling `spawnEnemy()`, the scenario mutates the enemy's `lastSpawnTime` to `Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 500` (same backdate as before).
- The scenario still clears `gameState.enemies` before spawning, and sets `player.hp` / `player.magicStones` as before.
- All existing server and integration tests still pass.

## Technical Specs
- **File:** `game/server/index.js` — lines ~737–755 (`spawner-active` branch in `applyDebugScenario`)
- Replace the object literal with:
  ```js
  spawnEnemy(player.x + 4, player.z, 'spawner');
  const spawner = gameState.enemies[gameState.enemies.length - 1];
  spawner.lastSpawnTime = Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 500;
  ```
- Remove the manual `{ id, x, z, type, hp, maxHp, state, attackState, wanderTarget, lastSpawnTime }` literal and the `gameState.enemies.push(spawner)` call.

## Verification: code
