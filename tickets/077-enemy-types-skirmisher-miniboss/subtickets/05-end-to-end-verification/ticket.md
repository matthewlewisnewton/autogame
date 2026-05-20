# End-to-End Verification: all enemy types integrated and tested

## Description

Sub-tickets 01–04 implemented `ENEMY_DEFS`, per-type stats, mesh variants, health bars, and tests. This sub-ticket verifies the complete integration: all unit and integration tests pass, the server correctly spawns mixed packs, the client renders all three types with correct health bars, and existing combat paths (cards, minions, loot, run objective) work for every enemy type. No new game code — only confirming correctness via test execution and diff review.

## Acceptance Criteria

- `npm test` (or equivalent vitest run) passes with **zero failures** across both server and client test suites.
- Server tests confirm: `ENEMY_DEFS` exported with 3 keys, `spawnEnemies()` yields 3 skirmishers + 1 grunt + 1 miniboss, unknown type rejected, per-type chase speed and damage verified.
- Integration tests confirm: killing a skirmisher removes it and increments `defeatedEnemies`; killing a miniboss (multi-hit) does the same.
- Client tests confirm: `createEnemyMesh()` returns correct geometry/color for `grunt`, `skirmisher`, `miniboss`; `enemyMeshHalfHeight()` returns correct y-offsets; health bar ratio uses per-enemy `maxHp`.
- `updateEnemies()` in the diff shows `ENEMY_DEFS[enemy.type]` lookups for `chaseSpeed`, `wanderSpeed`, `attackDamage`, `attackWindupMs` (no hardcoded global constants used for per-enemy behavior).
- `spawnEnemies()` in the diff uses a spawn table with mixed types (not 5 identical grunts).
- Client enemy sync in the diff uses `createEnemyMesh(enemy.type)` and per-enemy `maxHp` for health bar scaling.
- Existing run-objective tracking (`totalEnemies`, `defeatedEnemies`) counts all enemy types.

## Technical Specs

- **No game code changes.** This sub-ticket is a verification pass.
- The QA (code mode) reads the full diff from the previous 4 sub-tickets, runs the test suite, and checks:
  - All tests green
  - `ENEMY_DEFS` present and exported in `game/server/index.js`
  - `spawnEnemies()` mixed pack in `game/server/index.js`
  - `updateEnemies()` per-type stat lookups in `game/server/index.js`
  - `createEnemyMesh(type)` and `enemyMeshHalfHeight(type)` in `game/client/main.js`
  - Per-enemy `maxHp` used in health bar logic in `game/client/main.js`
  - No regressions in existing enemy state machine, minion damage, loot drops, or run completion

## Verification: code
