# Tests for persistence-backend env passthrough in playthrough driver

Add unit tests verifying that `startGame()` in `gameProcess.mjs` correctly passes `PERSISTENCE_BACKEND`, `DATABASE_URL`, and `REDIS_URL` through to the server child when set, and falls back to `'memory'` when unset.

## Acceptance Criteria

- Test confirms that when `PERSISTENCE_BACKEND=postgres` is set in the parent env, the server child receives `PERSISTENCE_BACKEND: 'postgres'` (not `'memory'`)
- Test confirms that when `PERSISTENCE_BACKEND` is unset, the server child receives `PERSISTENCE_BACKEND: 'memory'`
- Test confirms that `DATABASE_URL` set in parent env is passed through to the server child
- Test confirms that `REDIS_URL` set in parent env is passed through to the server child
- All existing harness tests continue to pass

## Technical Specs

- **File to add:** `harness/validate/lib/gameProcess.test.mjs` (or add to existing test file if one already covers `gameProcess.mjs`)
- **Approach:** Since `startGame()` actually spawns a real server process, tests should either:
  - Mock `spawn` / `launch` and assert the `env` object passed to it, OR
  - Extract the env-construction logic into a pure helper function (e.g., `buildServerEnv(parentPort)`) and test that directly
- Prefer extracting a `buildServerEnv()` helper to keep tests fast and deterministic without mocking `child_process`.
- Run via `pnpm test` from `game/` or `node --import=... harness/...` — match existing harness test patterns.

## Verification: code
