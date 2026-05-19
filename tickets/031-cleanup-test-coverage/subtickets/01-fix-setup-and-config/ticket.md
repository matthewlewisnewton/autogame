# Remove no-op loop from client test setup and verify vitest config

The no-op `for` loop in `game/client/test/setup.js` assigns each THREE key to itself, doing nothing. Additionally, confirm the vitest config is using the correct `environmentMatchGlobs` (already fixed in a prior ticket — just verify no regression).

## Acceptance Criteria

- The no-op `for (const key of Object.keys(THREE)) { THREE[key] = THREE[key]; }` loop is removed from `game/client/test/setup.js`.
- `npm test` still passes all 336+ tests.
- `game/vitest.config.js` uses valid vitest config keys (`environmentMatchGlobs` or `environment`) — no dead or misspelled keys.

## Technical Specs

- **File to change:** `game/client/test/setup.js` — delete the no-op `for` loop (around line 77).
- **File to verify (no change expected):** `game/vitest.config.js` — confirm `environmentMatchGlobs` is present and correct.

## Verification: code
