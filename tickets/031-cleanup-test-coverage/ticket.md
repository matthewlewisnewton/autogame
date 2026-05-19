# Cleanup nits from 017-test-coverage

> **Staleness note.** This follow-up ticket was written against commit
> `30c304e` (2026-05-18). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `017-test-coverage`.
None blocked acceptance — clean them up when convenient.

## Fix invalid `environments` key in vitest.config.js
`game/vitest.config.js` uses a `test.environments` key (a plural object mapping
globs to environments). Vitest has no such option — it expects a single
`environment` string or per-project config. The key is silently ignored, so
every test (including client tests) runs in the default `node` environment and
the installed `jsdom` dependency is never used. Currently harmless because the
tested client modules are pure logic, but the config is misleading.
### Acceptance Criteria
- `vitest.config.js` either uses a valid per-environment mechanism (e.g. a
  `projects`/workspace config or `environmentMatchGlobs`) or a single correct
  `environment`, with no dead config keys.
- `npm test` still passes all tests.

## Rename misleading client test file
`game/client/test/main.test.js` contains no tests for `main.js`; it tests
`collision.js` and `hand.js`. The filename misleads anyone navigating the suite.
### Acceptance Criteria
- The collision/hand tests live in an accurately named file (e.g.
  `collision.test.js` and `hand.test.js`, or `collision-hand.test.js`).
- `npm test` still discovers and passes all tests.

## Include all tested client modules in coverage scope
`vitest.config.js` `coverage.include` lists only `server/index.js` and
`client/cards.js`. `client/collision.js` and `client/hand.js` are unit-tested
but excluded from the coverage report and threshold, so "overall" coverage does
not reflect all tested code.
### Acceptance Criteria
- `coverage.include` lists `client/collision.js` and `client/hand.js` alongside
  the existing entries.
- The 70% thresholds still pass with the expanded scope.

## Add a delta-time calculation unit test
The ticket's criterion 3 names "delta-time calculations" as example client
logic to cover; no dedicated test exists. If a frame delta-time helper is worth
extracting from `main.js`, do so and test it.
### Acceptance Criteria
- A pure delta-time helper is extracted (if not already) and covered by a unit
  test asserting its behavior (e.g. clamping, conversion to seconds).

## Remove no-op loop in client/test/setup.js
`game/client/test/setup.js` has `for (const key of Object.keys(THREE)) { THREE[key] = THREE[key]; }`,
which assigns each value to itself and does nothing.
### Acceptance Criteria
- The no-op loop is removed; `npm test` still passes.
