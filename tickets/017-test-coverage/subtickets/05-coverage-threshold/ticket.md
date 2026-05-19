# Coverage Threshold Enforcement

Configure Vitest to report code coverage and enforce a minimum threshold so the test suite fails if coverage drops below the target. This ensures the tests from the previous sub-tickets actually cover the required portion of the codebase.

## Acceptance Criteria
- A coverage provider (`@vitest/coverage-v8` or `@vitest/coverage-istanbul`) is installed and configured in `vitest.config.js`.
- Running `npm test` produces a coverage report (text summary in the terminal + HTML report in a `coverage/` directory).
- A minimum coverage threshold of **70%** is enforced for `statements`, `branches`, `functions`, and `lines`.
- The test run **fails** (non-zero exit code) if any measured dimension falls below 70%.
- The threshold applies to the union of `game/server/index.js` and `game/client/cards.js` and `game/client/main.js`.
- Running `npm test` from `game/` completes successfully with all thresholds met (given the tests from sub-tickets 02–04 are in place).

## Technical Specs
- **Files to create**:
  - None (all changes are configuration additions to existing files).
- **Files to modify**:
  - `game/package.json` — add `@vitest/coverage-v8` (or `@vitest/coverage-istanbul`) as a devDependency.
  - `game/vitest.config.js` — add `test.coverage` configuration block with `provider: 'v8'` (or `'istanbul'`), `reportsDirectory: './coverage'`, `include` for the source files, and `thresholds` set to 70 across all dimensions.
  - `game/package.json` — update the `"test"` script to include the `--coverage` flag (e.g., `"test": "vitest run --coverage"`).

## Verification: code
