# Codebase Cleanup and Refactor

Review and clean up the entire codebase, ensuring high code quality without introducing any regressions.

## Difficulty: hard

## Acceptance Criteria
- Code is refactored for readability, consistency, and maintainability.
- Extracted constants and config values into shared files.
- Duplicate or unnecessary code is removed.
- All automated tests introduced in ticket `017-test-coverage` must continue to pass without modification (or with only expected structural updates if files move).
- The client and server start and function as expected.

## Technical Specs
- **Files to modify**: Across `game/server/` and `game/client/`.
- **Guidelines**: Look for large functions to break down, improve variable naming, add comments to complex logic, and ensure consistent code style (e.g., via Prettier or ESLint).
- **Validation**: Run `pnpm test` (or `npm test`) frequently during the refactoring process to catch regressions immediately.
