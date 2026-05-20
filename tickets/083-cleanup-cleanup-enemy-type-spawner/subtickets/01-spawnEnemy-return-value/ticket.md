# Return spawned enemy from `spawnEnemy()`

Make `spawnEnemy()` return the enemy object it pushes onto `gameState.enemies`, and update the `spawner-active` debug scenario to use the return value instead of indexing into the array.

## Acceptance Criteria
- `spawnEnemy()` in `game/server/index.js` returns the enemy object it creates.
- The `spawner-active` branch in `applyDebugScenario` uses the return value (`const spawner = spawnEnemy(...)`) instead of `gameState.enemies[gameState.enemies.length - 1]`.
- All existing server and integration tests still pass.

## Technical Specs
- **`game/server/index.js`** (~line 645): change `gameState.enemies.push(enemy);` to `gameState.enemies.push(enemy); return enemy;`
- **`game/server/index.js`** (~line 743): replace the two-line pattern (`spawnEnemy(...); const spawner = gameState.enemies[...]`) with `const spawner = spawnEnemy(player.x + 4, player.z, 'spawner');`

## Verification: code
