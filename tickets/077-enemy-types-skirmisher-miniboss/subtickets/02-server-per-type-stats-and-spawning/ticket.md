# Server: per-type stats in updateEnemies() and mixed spawn table

## Description

Make `updateEnemies()` look up per-enemy chase speed, wander speed, attack damage, and windup duration from `ENEMY_DEFS` using the enemy's `type` field. Replace the fixed "5 grunts" loop in `spawnEnemies()` with a mixed spawn table (3 skirmishers, 1 grunt, 1 miniboss).

## Acceptance Criteria

- `updateEnemies()` uses `ENEMY_DEFS[enemy.type].chaseSpeed` instead of the global `CHASE_SPEED` constant for movement.
- `updateEnemies()` uses `ENEMY_DEFS[enemy.type].wanderSpeed` instead of the global `WANDER_SPEED` constant for wandering.
- `damagePlayer()` call inside windup uses `ENEMY_DEFS[enemy.type].attackDamage` instead of `ENEMY_ATTACK_DAMAGE`.
- Windup duration check uses `ENEMY_DEFS[enemy.type].attackWindupMs` instead of `ENEMY_ATTACK_WINDUP_MS`.
- `spawnEnemies()` produces exactly 5 enemies: 3 `skirmisher`, 1 `grunt`, 1 `miniboss` (total stays at 5).
- `ensureNearbyEnemy()` spawns a `grunt` (unchanged behavior).
- Global constants `CHASE_SPEED`, `WANDER_SPEED`, `ENEMY_ATTACK_DAMAGE`, `ENEMY_ATTACK_WINDUP_MS` may remain exported for backward compat but are no longer used internally by `updateEnemies()`.
- `createRunState()` still sets `totalEnemies` from `gameState.enemies.length` (should be 5).

## Technical Specs

- **File**: `game/server/index.js`
  - In `updateEnemies()`, at the top of the per-enemy loop, resolve the def:
    ```js
    const def = ENEMY_DEFS[enemy.type];
    ```
  - Replace `CHASE_SPEED * dt` → `def.chaseSpeed * dt`
  - Replace `WANDER_SPEED * dt` → `def.wanderSpeed * dt`
  - Replace `ENEMY_ATTACK_WINDUP_MS` in the windup elapsed check → `def.attackWindupMs`
  - Replace `damagePlayer(enemy.windupTargetId, ENEMY_ATTACK_DAMAGE)` → `damagePlayer(enemy.windupTargetId, def.attackDamage)`
  - Replace `spawnEnemies()` body with a spawn table:
    ```js
    const spawnTable = ['skirmisher', 'skirmisher', 'skirmisher', 'grunt', 'miniboss'];
    for (const type of spawnTable) {
      const pos = randomRoomPosition();
      spawnEnemy(pos.x, pos.z, type);
    }
    ```
  - `ensureNearbyEnemy()` should call `spawnEnemy(x + 3, z, 'grunt')`.

## Verification: code
