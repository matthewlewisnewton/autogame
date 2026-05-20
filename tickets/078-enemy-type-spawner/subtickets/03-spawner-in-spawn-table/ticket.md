# Include Spawner in Default Spawn Table

Adjust the run-start `spawnEnemies()` spawn table so that every new run includes exactly one spawner among the initial enemies.

## Acceptance Criteria

- `spawnEnemies()` spawn table includes exactly one `'spawner'` entry.
- Total initial spawn count remains ~5 (e.g., 2× skirmisher, 1× grunt, 1× miniboss, 1× spawner — or similar mix).
- After calling `spawnEnemies()`, `gameState.enemies` contains at least one enemy of type `spawner`.
- No regression: grunt, skirmisher, and miniboss still appear in the spawn mix.

## Technical Specs

- **File:** `game/server/index.js` — modify the `spawnTable` array in `spawnEnemies()` from `['skirmisher', 'skirmisher', 'skirmisher', 'grunt', 'miniboss']` to include one `'spawner'` (e.g., replace one skirmisher with spawner: `['skirmisher', 'skirmisher', 'grunt', 'miniboss', 'spawner']`).
- **File:** `game/server/test/server.test.js` — add a test that calls `spawnEnemies()` and asserts the resulting enemy types include a spawner.

## Verification: code
