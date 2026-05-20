# Tests: ENEMY_DEFS validation and kill per new type

## Description

Add unit and integration tests covering the `ENEMY_DEFS` map, type validation at spawn, per-type stat usage in `updateEnemies()`, and at least one kill per new enemy type via weapon card.

## Acceptance Criteria

- Unit test verifies `ENEMY_DEFS` is exported and contains `grunt`, `skirmisher`, `miniboss` with correct stat values.
- Unit test verifies `spawnEnemy()` (or `spawnEnemies()`) rejects an unknown type (throws error or does not push to `gameState.enemies`).
- Unit test verifies `spawnEnemies()` produces a mixed pack: 3 skirmishers, 1 grunt, 1 miniboss.
- Unit test verifies skirmishers move faster than grunts in `updateEnemies()` (chase distance per tick is larger).
- Unit test verifies miniboss takes more hits to kill (higher HP) than a grunt under same damage.
- Unit test verifies skirmisher deals less damage than grunt on successful windup.
- Integration test: player uses a weapon card to kill a skirmisher (hp goes to 0, enemy removed, `defeatedEnemies` incremented).
- Integration test: player uses a weapon card to kill a miniboss (requires multiple hits or AoE, `defeatedEnemies` incremented).
- Existing tests for `updateEnemies()` state machine, minion damage, and run completion still pass.

## Technical Specs

- **Files**:
  - `game/server/test/server.test.js` — add unit tests
  - `game/server/test/integration.test.js` — add integration tests

- **Unit tests** in `server.test.js`:
  - Import `ENEMY_DEFS` from `../index.js`.
  - `describe('ENEMY_DEFS')` block:
    - Test each key exists with expected `hp`, `chaseSpeed`, `wanderSpeed`, `attackDamage`, `attackWindupMs`.
    - Test that calling spawn with unknown type throws (mock `gameState.enemies = []`, call spawn helper, expect error).
  - `describe('spawnEnemies mixed pack')`:
    - Reset state, call `spawnEnemies()`, check `gameState.enemies.length === 5` and count of each `type`.
  - `describe('per-type chase speed')`:
    - Set up a skirmisher and grunt at same distance from player, call `updateEnemies()` once, verify skirmisher moved further.
  - `describe('per-type damage')`:
    - Set up skirmisher and miniboss in windup state targeting player, advance time past windup, verify different damage amounts applied.

- **Integration tests** in `integration.test.js`:
  - `describe('killing skirmisher')`:
    - Start run, connect player, play weapon card targeting a skirmisher enemy, verify `defeatedEnemies` increments and enemy is removed.
  - `describe('killing miniboss')`:
    - Start run, connect player, play weapon card(s) to reduce miniboss HP to 0, verify `defeatedEnemies` increments.

## Verification: code
