# Include all tested client modules in coverage scope

`vitest.config.js` `coverage.include` lists only `server/index.js` and `client/cards.js`. The files `client/collision.js` and `client/hand.js` are unit-tested but excluded from the coverage report, so the reported "overall" coverage does not reflect all tested code.

## Acceptance Criteria

- `coverage.include` in `game/vitest.config.js` lists `client/collision.js` and `client/hand.js` alongside existing entries.
- The 70% coverage thresholds still pass with the expanded scope.
- `npm test` passes all tests including the coverage gate.

## Technical Specs

- **File to change:** `game/vitest.config.js` — add `'client/collision.js'` and `'client/hand.js'` to the `coverage.include` array.
- These files already have tests, so coverage should be high (near 100% based on existing test suites).

## Verification: code
