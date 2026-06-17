# Pass PERSISTENCE_BACKEND, DATABASE_URL, REDIS_URL through to server child

`harness/validate/lib/gameProcess.mjs` hardcodes `PERSISTENCE_BACKEND: 'memory'` in the server child env (line ~129), overriding any value the caller exports. Fix: when `PERSISTENCE_BACKEND`, `DATABASE_URL`, or `REDIS_URL` are already set in the parent environment, pass them through to the server child process. Fall back to `'memory'` only when `PERSISTENCE_BACKEND` is unset, preserving today's fast/isolated default for existing validation presets.

## Acceptance Criteria

- `startGame()` in `gameProcess.mjs` reads `PERSISTENCE_BACKEND` from `process.env` and passes it through to the server child when set
- `DATABASE_URL` from `process.env` is passed through to the server child when set
- `REDIS_URL` from `process.env` is passed through to the server child when set
- When `PERSISTENCE_BACKEND` is unset in the parent env, the server child receives `PERSISTENCE_BACKEND: 'memory'` (backward-compatible default)
- The hard-coded `PERSISTENCE_BACKEND: 'memory'` override is removed

## Technical Specs

- **File to change:** `harness/validate/lib/gameProcess.mjs`
- **Change:** In the `launch()` call inside `startGame()`, replace the hard-coded `PERSISTENCE_BACKEND: 'memory'` with conditional passthrough:
  - `PERSISTENCE_BACKEND: process.env.PERSISTENCE_BACKEND ?? 'memory'`
  - Because `...process.env` is already spread first, `DATABASE_URL` and `REDIS_URL` will naturally pass through if set — no explicit addition needed. The key fix is removing the hard-coded override of `PERSISTENCE_BACKEND`.
- **Do not** change `PORT`, `ALLOW_DEBUG_SCENARIOS`, or `ALLOW_DEV_AUTH` — those remain explicitly set by the harness.

## Verification: code
