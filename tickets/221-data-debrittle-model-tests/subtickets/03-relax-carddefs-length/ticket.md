# 03-relax-carddefs-length

Replace the exact `CARD_DEFS` length assertion (`toHaveLength(42)`) in `new_card_pack.test.js` with a floor check (`>= 42`) so adding new cards does not break the test.

## Acceptance Criteria

- `game/server/test/new_card_pack.test.js` no longer contains `.toHaveLength(42)` (or any exact-count assertion on `Object.keys(CARD_DEFS)`).
- The test uses `.toBeGreaterThanOrEqual(42)` (or equivalent) with a comment explaining this is a minimum floor, not an exact count.
- All tests in `new_card_pack.test.js` still pass.

## Technical Specs

- **File**: `game/server/test/new_card_pack.test.js`
  - Find the line `expect(Object.keys(CARD_DEFS)).toHaveLength(42);` (around line 72).
  - Replace with `expect(Object.keys(CARD_DEFS).length).toBeGreaterThanOrEqual(42);` and add a short comment: `// floor check — adding cards is data-only and should not break this test`.
  - No other changes to this file.

## Verification: code
