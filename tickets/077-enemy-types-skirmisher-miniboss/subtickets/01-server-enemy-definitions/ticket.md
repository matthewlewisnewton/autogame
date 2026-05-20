# Server: ENEMY_DEFS map and type field

## Description

Introduce a server-owned `ENEMY_DEFS` constant map with entries for `grunt`, `skirmisher`, and `miniboss`. Add a `type` field to every enemy object at spawn time and reject unknown types. This sub-ticket defines the data layer only — no behavior changes yet.

## Acceptance Criteria

- `ENEMY_DEFS` is exported from `game/server/index.js` with at least three keys: `grunt`, `skirmisher`, `miniboss`.
- Each definition contains: `hp`, `chaseSpeed`, `wanderSpeed`, `attackDamage`, `attackWindupMs`.
- Every enemy pushed to `gameState.enemies[]` gets a `type` field set to a valid key in `ENEMY_DEFS`.
- Spawn functions (`spawnEnemies`, `ensureNearbyEnemy`) that create enemies without an explicit `type` default to `'grunt'`.
- Passing an unknown type to a spawn helper throws or is otherwise rejected (no silent fallback).
- Existing `spawnEnemies()` still spawns 5 enemies (unchanged types — all `grunt`) so existing tests pass.

## Technical Specs

- **File**: `game/server/index.js`
  - Add `ENEMY_DEFS` constant (object map) after existing enemy constants:
    ```js
    const ENEMY_DEFS = {
      grunt:      { hp: 50,  chaseSpeed: 2.5, wanderSpeed: 1.0, attackDamage: 10, attackWindupMs: 800 },
      skirmisher: { hp: 20,  chaseSpeed: 4.5, wanderSpeed: 1.5, attackDamage: 6,  attackWindupMs: 500 },
      miniboss:   { hp: 150, chaseSpeed: 1.2, wanderSpeed: 0.6, attackDamage: 18, attackWindupMs: 1200 },
    };
    ```
  - Add `type: 'grunt'` and `maxHp: 50` to every enemy object created in `spawnEnemies()` and `ensureNearbyEnemy()`.
  - Create a small `spawnEnemy(x, z, type = 'grunt')` helper that validates `type` against `Object.keys(ENEMY_DEFS)` and pushes the enemy with `hp: ENEMY_DEFS[type].hp` and `maxHp: ENEMY_DEFS[type].hp`.
  - Replace inline enemy object creation in `spawnEnemies()` and `ensureNearbyEnemy()` with calls to `spawnEnemy()`.
  - Export `ENEMY_DEFS` at the bottom of the file alongside existing enemy constant exports.

## Verification: code
