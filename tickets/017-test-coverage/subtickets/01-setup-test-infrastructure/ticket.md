# Setup Test Infrastructure

Install and configure **Vitest** as the test runner for both server and client code. Vitest is chosen over Jest because the client already uses Vite (ESM), and Vitest provides native ESM support with zero-config for Vite projects.

Add a `test` script to `game/package.json` that runs the full suite, and a `test` script to each sub-package (`server`, `client`) for targeted runs.

## Acceptance Criteria
- `vitest` is installed as a devDependency in `game/package.json` (or in sub-packages).
- A `vitest.config.js` (or equivalent Vite-based config) exists under `game/` configuring the test environment.
- `game/package.json` has a `"test"` script (e.g., `"test": "vitest run"`) that executes the full test suite.
- `game/server/package.json` has a `"test"` script for server-only tests.
- `game/client/package.json` has a `"test"` script for client-only tests.
- Running `npm test` from `game/` completes without error (even with zero test files present).
- Test directories exist: `game/server/test/` and `game/client/test/`.

## Technical Specs
- **Files to create**:
  - `game/vitest.config.js` — Vitest config with `test.dirs` pointing to `server/test` and `client/test`; server tests run in `node` environment, client tests in `jsdom` or `happy-dom`.
  - `game/server/test/.gitkeep`
  - `game/client/test/.gitkeep`
- **Files to modify**:
  - `game/package.json` — add `vitest` devDependency and `"test"` script.
  - `game/server/package.json` — add `"test"` script (e.g., `"vitest run --config ../../vitest.config.js server"`).
  - `game/client/package.json` — add `"test"` script (e.g., `"vitest run --config ../../vitest.config.js client"`).

## Verification: code
