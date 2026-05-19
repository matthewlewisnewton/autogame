# Objective Tests

Add unit and integration tests covering the run state creation, enemy defeat accounting, and objective progress clamping.

## Acceptance Criteria
- A unit test verifies `createRunState()` produces an object with all required fields (`id`, `status`, `objective.type`, `objective.label`, `objective.totalEnemies`, `objective.defeatedEnemies`, `startedAt`).
- A unit test verifies `recordEnemyDefeated(n)` increments `defeatedEnemies` by `n`.
- A unit test verifies `recordEnemyDefeated()` clamps `defeatedEnemies` at `totalEnemies` (calling it past the total does not overshoot).
- A unit test verifies `recordEnemyDefeated()` is a no-op when `gameState.run` is undefined.
- An integration test verifies that after two players ready up and the game starts, both receive state containing a `run` object with correct initial values.
- An integration test verifies that killing an enemy through `useCard` (weapon card) advances `run.objective.defeatedEnemies` by 1.

## Technical Specs
- **File**: `game/server/test/server.test.js`
  - Add a `describe('run state')` block with tests for `createRunState`, `recordEnemyDefeated`, and `clampObjectiveProgress`.
  - Import `createRunState`, `recordEnemyDefeated`, `clampObjectiveProgress` from `../index.js` (added in sub-tickets 01 and 02).
  - Use `resetState()` / `Object.assign(gameState, createGameState())` to isolate tests.
  - For `createRunState` test: set `gameState.enemies` to a known array, call the function, assert all fields.
  - For clamp test: manually set `gameState.run` with `totalEnemies: 5`, call `recordEnemyDefeated(10)`, assert `defeatedEnemies === 5`.
  - For no-op test: ensure `gameState.run` is undefined, call `recordEnemyDefeated(1)`, assert no error.
- **File**: `game/server/test/integration.test.js`
  - Add a `describe('dungeon run objective')` block.
  - For the "run exists after start" test: connect two clients, both emit `playerReady(true)`, wait for `startGame`, assert that the next `stateUpdate` contains `run` with `status: 'playing'`, `objective.type: 'defeat_enemies'`, and `defeatedEnemies: 0`.
  - For the "killing enemy advances objective" test: connect a client, use a debug scenario or manual setup to get into playing phase with enemies alive, emit `useCard` with a weapon card that hits an enemy, assert that the subsequent `stateUpdate` shows `defeatedEnemies: 1`.

## Verification: code
