# Remove stale enemy combat constants

`ENEMY_ATTACK_DAMAGE`, `ENEMY_ATTACK_WINDUP_MS`, `CHASE_SPEED`, and `WANDER_SPEED` in `game/server/index.js` duplicate `ENEMY_DEFS.grunt.*` values. `updateEnemies()` already reads per-type values from `ENEMY_DEFS`, so these top-level constants are stale — but they're still exported and asserted in tests.

Refactor: delete `CHASE_SPEED` and `WANDER_SPEED` (unused by `updateEnemies`; `CHASE_SPEED` is only used by `updateMinions` which should also read from a def or its own constant). Delete `ENEMY_ATTACK_DAMAGE` and `ENEMY_ATTACK_WINDUP_MS`, replacing all test references with `ENEMY_DEFS.grunt.attackDamage` and `ENEMY_DEFS.grunt.attackWindupMs`. Remove them from exports.

## Acceptance Criteria
- `ENEMY_ATTACK_DAMAGE`, `ENEMY_ATTACK_WINDUP_MS`, `CHASE_SPEED`, `WANDER_SPEED` are removed from `game/server/index.js`
- `updateEnemies()` continues to read from `ENEMY_DEFS` (no behavior change)
- `updateMinions()` either uses its own speed constant or reads from `ENEMY_DEFS` — no reference to the deleted `CHASE_SPEED`
- All server unit tests pass (`npm test` in `game/server/`)
- All server integration tests pass
- The constants are removed from `module.exports`

## Technical Specs
- **File:** `game/server/index.js` — remove `const WANDER_SPEED` (line ~131), `const CHASE_SPEED` (line ~133), `const ENEMY_ATTACK_DAMAGE` (line ~137), `const ENEMY_ATTACK_WINDUP_MS` (line ~138). Replace the one remaining usage of `CHASE_SPEED` in `updateMinions()` (line ~943) with a local constant or inline value. Remove from `module.exports` (lines ~1515-1516).
- **File:** `game/server/test/server.test.js` — replace imports of `ENEMY_ATTACK_DAMAGE` / `ENEMY_ATTACK_WINDUP_MS` with `ENEMY_DEFS`. Update test assertions to use `ENEMY_DEFS.grunt.attackDamage` and `ENEMY_DEFS.grunt.attackWindupMs`. Remove the "constants exported with expected values" test or update it to assert `ENEMY_DEFS.grunt` values.
- **File:** `game/server/test/integration.test.js` — replace imports of `ENEMY_ATTACK_DAMAGE` / `ENEMY_ATTACK_WINDUP_MS` with `ENEMY_DEFS`. Update `sleep(ENEMY_ATTACK_WINDUP_MS + 200)` to `sleep(ENEMY_DEFS.grunt.attackWindupMs + 200)`.

## Verification: code
