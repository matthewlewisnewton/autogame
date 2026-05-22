# Fix misnamed wall-slide reached test

The test `returns reached: true after wall-slide lands within stopDistance` in `game/server/test/server.test.js` asserts `reached` is **false** — the name is the opposite of what the test checks. Rename the test to accurately describe its behavior.

## Acceptance Criteria
- The test title matches its assertion: the test expects `reached` to be `false` after wall-slide when the entity remains beyond `stopDistance`.
- The test's internal comment (`// This validates the wall-slide path computes reached (false when still far).`) is consistent with the new title.
- All `moveEntityToward` tests still pass.

## Technical Specs
- **File**: `game/server/test/server.test.js` (~line 2894)
- Rename test from `returns reached: true after wall-slide lands within stopDistance` to `returns reached: false after wall-slide leaves entity beyond stopDistance` (or equivalent wording matching the actual assertion).
- No logic change — the test assertions and setup are correct; only the title is wrong.

## Verification: code
