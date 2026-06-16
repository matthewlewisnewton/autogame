# Regression test: escort follows player to dais while a nearby grunt is still alive

Add a vitest that reproduces the `escort-near-destination` soft-lock: escort NPC staged just outside the arena-dais arrival radius, wave-0 grunt still alive within `DETECTION_RADIUS`, player already on the dais. Today the escort never moves and the run stays `playing` forever; the test must fail on current code and pass once sub-ticket 02 lands.

## Acceptance Criteria

- A new `describe` block in `game/server/test/escort_objective.test.js` (e.g. `escort follow with nearby living enemy`) deploys `escort_objective_fixture` tier 1 via the existing `deployEscortRun` helper.
- After deploy, the test positions: player on the `arena_dais` landmark; escort at `destination.x + ESCORT_DESTINATION_RADIUS + 4.5`, `destination.z` (matching the debug scenario staging ~8.5 units from dais on open-plaza); at least one wave-0 grunt remains alive with `hp > 0` (do not clear `gameState.enemies`).
- The test runs `updateEnemies()` and `updateMinions()` together for enough ticks (e.g. 120+) to let the escort traverse the gap if follow AI is working.
- Assertions: escort `x` moves measurably toward the dais (`escort.x` is closer to `destination.x` than its start position); `isEscortAtDestination` becomes true; `gameState.run.status` becomes `'victory'` after `tickEscort`.
- Existing escort tests in the same file continue to pass.
- `pnpm test` (server vitest) passes once sub-ticket 02 is implemented (this test is expected to **fail** on unfixed code — that failure documents the bug).

## Technical Specs

- **`game/server/test/escort_objective.test.js`**: Import `ESCORT_DESTINATION_RADIUS` from `../escort.js` (export it if not already exported). Import `updateEnemies` from `../index.js` alongside `updateMinions`. Add the regression `it(...)` described above. Use `gameState.layout.landmarks.find(lm => lm.type === 'arena_dais')` for destination coords. Do not modify simulation logic in this ticket.
- **`game/server/escort.js`**: Export `ESCORT_DESTINATION_RADIUS` if tests cannot already read it (constant is defined at top of file).

## Verification: code
