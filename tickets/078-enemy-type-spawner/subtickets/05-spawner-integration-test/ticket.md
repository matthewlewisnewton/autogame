# Spawner End-to-End Integration Test

Add an integration test that starts a run containing a spawner, advances the game loop past the spawn interval, and verifies that the enemy count increases with at least one skirmisher add tagged to the spawner.

## Acceptance Criteria

- Integration test starts a server, connects a client, enters playing phase (via debug scenario or ready flow).
- Test verifies the initial enemy list contains a spawner.
- Test advances time (via `setTimeout` or multiple `updateEnemies()` calls) past `spawnIntervalMs` (4000ms).
- After the interval, test asserts:
  - `gameState.enemies.length` has increased (at least one new skirmisher).
  - At least one enemy has `type: 'skirmisher'` and `spawnedBy` matching the spawner's id.
- Test verifies no regression: grunt/miniboss enemies still present and unaffected.

## Technical Specs

- **File:** `game/server/test/integration.test.js` — add new `describe('spawner spawns skirmishers (integration)')` block following existing patterns (`startTestServer`, `connectClient`, `debugScenario`, `waitForEvent`, `closeServer`).
- Use `waitForEvent(socket, 'stateUpdate')` to observe enemy count changes, or directly inspect `gameState.enemies` after time advance.
- Export `updateEnemies` is already available from `game/server/index.js` for direct invocation if needed.

## Verification: code
