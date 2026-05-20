# Fix Failing Integration Tests

The changed-file Vitest coverage run has 17 failing integration tests. Some failures are stale expectations from the pre-intent-protocol era (absolute positions, old damage paths). Others may be side effects of the new server validation (elapsed cap, swept collision, card cooldowns). Update all failing tests to match the current protocol and add coverage for the new validation logic.

## Acceptance Criteria
- Running `pnpm run test --coverage --coverage.include='server/**/*.js'` from `game/` exits with code 0 and 0 failing tests.
- All existing test names/descriptions are preserved (tests are updated, not deleted).
- Movement tests assert the intent-based protocol (`{ dx, dz, rotation }`) and verify server-side elapsed-time integration.
- Tests cover the new swept collision logic: a move that tunnels through a wall is rejected.
- Tests cover the new card cooldown: a second `useCard` on the same slot within `COOLDOWN_MS` is rejected with `cardError`.
- Tests cover full hand reconciliation: server corrections to `remainingCharges` (same card id) are reflected on the client.
- No new test files are created; all changes are in the existing `game/server/test/integration.test.js`.

## Technical Specs
- **File**: `game/server/test/integration.test.js` —
  1. Run the current test suite to identify the 17 failing tests and their error messages.
  2. For each failing test, update the assertion to match the current protocol:
     - Move tests: emit `{ dx, dz, rotation }` instead of `{ x, y, z, rotation }`; assert position changes via `stateUpdate` payload rather than exact coordinates.
     - Card tests: assert `cardError` is emitted when cooldown is active.
     - Hand reconciliation tests: verify that `remainingCharges` changes are reflected in the client's `stateUpdate` payload.
  3. Add new tests for swept collision: set up a wall between two open positions, emit a `move` that crosses the wall, and verify the move is rejected (position unchanged).
  4. Add new tests for card cooldown: emit `useCard` twice on the same slot within `COOLDOWN_MS` and verify the second emits `cardError`.
  5. Add test for elapsed cap: simulate a large time gap and verify the server caps movement to `MAX_ELAPSED_MS`.
  6. Ensure all helper functions (e.g., `connectClient`, `closeServer`) work correctly with the current server.
- **No other files changed.** Do not modify server logic, client code, config, or test infrastructure files outside `integration.test.js`.

## Verification: code
