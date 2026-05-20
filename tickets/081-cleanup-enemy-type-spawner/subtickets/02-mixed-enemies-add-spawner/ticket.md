# Add spawner to mixed-enemies debug scenario

The `mixed-enemies` debug scenario spawns one of each enemy type for visual verification but was not updated when the spawner type landed. Add a spawner spawn call so all four enemy types appear in `?debugScenario=mixed-enemies`.

## Acceptance Criteria
- `mixed-enemies` spawns one spawner in addition to the existing grunt, skirmisher, and miniboss.
- The spawner is spawned at a distinct position (not overlapping the other enemies).
- All four enemies receive a `wanderTarget` so they don't stack.
- All existing server and integration tests still pass.

## Technical Specs
- **File:** `game/server/index.js` — lines ~724–736 (`mixed-enemies` branch in `applyDebugScenario`)
- Add `spawnEnemy(player.x, player.z - 4, 'spawner');` (or similar offset) after the existing three `spawnEnemy` calls.
- The existing `for (const e of gameState.enemies)` loop that sets `wanderTarget` will automatically pick up the new spawner.

## Verification: code
