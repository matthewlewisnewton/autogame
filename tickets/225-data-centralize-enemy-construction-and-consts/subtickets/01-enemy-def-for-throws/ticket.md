# Enemy def lookup: throw on unknown type

Add a single `enemyDefFor(type)` helper and use it everywhere server code resolves combat stats by enemy type. Replace the silent `ENEMY_DEFS[enemy.type] || ENEMY_DEFS.grunt` fallback in `updateEnemies` so a bad or typo'd type fails loudly instead of behaving like a grunt.

## Acceptance Criteria

- `enemyDefFor(type)` exists in `game/server/simulation.js`, returns the matching entry from `ENEMY_DEFS`, and throws `Error` with message matching `/Unknown enemy type/` when `type` is absent from `ENEMY_DEFS`.
- `enemyDefFor` is exported from `simulation.js` (and re-exported via `index.js` if other modules need it).
- `updateEnemies` (`simulation.js` ~L1750) uses `enemyDefFor(enemy.type)` — no `|| ENEMY_DEFS.grunt` fallback remains anywhere under `game/server/`.
- `spawnEnemy` in `progression.js` delegates its existing type check to `enemyDefFor` (behavior unchanged: valid types still spawn, unknown types still throw before push).
- New test in `game/server/test/server.test.js`: seed `gameState.enemies` with `{ type: 'dragon', … }` and assert `updateEnemies()` throws `/Unknown enemy type/` without mutating player HP.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/simulation.js`: add `function enemyDefFor(type) { … }` next to `ENEMY_DEFS` (~L695–713). Replace `const def = ENEMY_DEFS[enemy.type] || ENEMY_DEFS.grunt;` in `updateEnemies` with `const def = enemyDefFor(enemy.type);`. Export `enemyDefFor` in the module.exports block (~L2331).
- `game/server/progression.js`: in `spawnEnemy` (~L2456–2459), replace inline `if (!ENEMY_DEFS[type]) throw …` with `const def = enemyDefFor(type);` (import `enemyDefFor` from `./simulation` alongside existing `ENEMY_DEFS` import).
- `game/server/index.js`: add `enemyDefFor` to simulation re-exports if the test harness imports constants from index.
- `game/server/test/server.test.js`: add `describe('enemyDefFor / updateEnemies unknown type', …)` with the corrupt-enemy tick test above.
- Do **not** change entity shape or minion AI in this ticket — only unify and harden type→def resolution.

## Verification: code
