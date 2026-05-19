# Server Unit Tests

Write unit tests for the pure functions and isolated game-state logic in `game/server/index.js`. Because the server is a single file with no exports, tests must either import the file as a script (evaluating its side effects) or refactor it to export testable units. The preferred approach is to add conditional exports (e.g., `if (typeof module !== 'undefined' && module.exports)`) so test files can access internals without changing production behavior.

## Acceptance Criteria
- Tests cover the `mulberry32(seed)` PRNG — verify deterministic output for a fixed seed and that it produces values in `[0, 1)`.
- Tests cover `generateLayout(seed)` — verify that a fixed seed always produces the same layout, that the result contains `rooms` and `passages` arrays, and that rooms respect grid bounds.
- Tests cover `damagePlayer(playerId, amount)` — verify HP reduction, death triggers respawn timer, and respawning resets position to `(0, 0)`.
- Tests cover the game loop functions `updateEnemies()` and `updateMinions()` — verify enemies chase players within `DETECTION_RADIUS` and minions attack enemies within `ATTACK_RANGE`.
- Tests cover `spawnLoot(x, z)` — verify loot object structure (value, position, expiry timestamp).
- Tests cover Magic Stone regeneration in the game tick — verify regen rate (`MAGIC_STONES_REGEN_PER_TICK`) and cap at `MAX_MAGIC_STONES`.
- Tests cover stale player cleanup — verify a player with no activity for `STALE_THRESHOLD` ms is removed.
- All tests pass with `npm test` in `game/server/`.

## Technical Specs
- **Files to create**:
  - `game/server/test/server.test.js` — main test file covering PRNG, dungeon generation, damage, game loop, loot, and stale cleanup.
- **Files to modify**:
  - `game/server/index.js` — add conditional exports at the bottom of the file to expose `mulberry32`, `generateLayout`, `damagePlayer`, `updateEnemies`, `updateMinions`, `spawnLoot`, `gameState` (or a factory to reset it), and constants (`STALE_THRESHOLD`, `MAX_MAGIC_STONES`, `MAGIC_STONES_REGEN_PER_TICK`, `DETECTION_RADIUS`, `ATTACK_RANGE`) for test access. Do not change any production logic.
- **Key detail**: The server currently starts the HTTP listener on `require` — tests must either mock `http.listen` or use a refactored init function that defers listening.

## Verification: code
