# Use `spawnEnemy()` return value in `spawnEnemies()`

Refactor `spawnEnemies()` to capture the enemy returned by `spawnEnemy()` and assign `wanderTarget` directly on it, eliminating the `gameState.enemies[gameState.enemies.length - 1]` peek pattern.

## Acceptance Criteria
- `spawnEnemies()` captures the return value of `spawnEnemy(...)` into a variable and assigns `wanderTarget` on that variable.
- No indexing into `gameState.enemies` for the purpose of setting `wanderTarget`.
- All existing server and integration tests still pass.

## Technical Specs
- **File**: `game/server/index.js` — refactor the `for` loop in `spawnEnemies()` (around line 647-654) to use `const enemy = spawnEnemy(pos.x, pos.z, type); enemy.wanderTarget = randomWanderTarget();`.

## Verification: code
