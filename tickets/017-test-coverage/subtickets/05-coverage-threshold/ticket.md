# Coverage Threshold Enforcement

Remove `client/main.js` from the Vitest coverage include list so the 70% threshold is achievable. The file is already wrapped in `v8 ignore` comments (its logic is UI/Three.js/Socket-dependent and extracted to testable modules), but remaining in the `include` list counts it as 0% and drags overall coverage to ~42%. Also clean up placeholder test files that serve no purpose.

## Acceptance Criteria
- `client/main.js` is removed from the `coverage.include` array in `game/vitest.config.js`.
- The `coverage.include` array still covers `server/index.js` and `client/cards.js` (the files with meaningful, testable logic).
- Placeholder test files (`client/test/infrastructure.test.js` and `server/test/infrastructure.test.js`) are deleted.
- Running `npm test` from `game/` completes successfully — all 112 tests pass AND all coverage dimensions (statements, branches, functions, lines) meet or exceed 70%.
- The terminal output shows a coverage report with overall coverage ≥ 70%.

## Technical Specs
- **Files to modify**:
  - `game/vitest.config.js` — remove `'client/main.js'` from the `coverage.include` array (leaving `'server/index.js'` and `'client/cards.js'`).
- **Files to delete**:
  - `game/client/test/infrastructure.test.js` — placeholder test with no real assertions.
  - `game/server/test/infrastructure.test.js` — placeholder test with no real assertions.

## Verification: code
