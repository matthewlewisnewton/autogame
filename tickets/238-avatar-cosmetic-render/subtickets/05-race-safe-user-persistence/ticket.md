# Race-safe user persistence under parallel Vitest

Parallel server tests that register users via HTTP routes still hit the shared default `game/data/users.json` because Vitest loads `users.js` twice (ESM `import` in tests vs CJS `require` in `auth.js`/`index.js`), so `setTestFilePath` on the ESM instance does not affect the instance the server uses. Concurrent saves also collide on a fixed `users.json.tmp` rename. Harden persistence and test setup so registration and profile PATCH never 500 with ENOENT during coverage runs.

## Acceptance Criteria

- `saveUsers()` uses a unique temporary filename per write (not a shared `usersFilePath + '.tmp'`) and still atomically renames to the target users file.
- Server HTTP suites that call `setTestFilePath` before `startServer()` configure the **CJS** `require('./users')` module instance (the same one `auth.js` uses), not only the ESM import copy.
- `server/test/cosmetic_runtime.test.js > PATCH profile cosmetic syncs an existing live player record and snapshot` passes (registration returns 201, not 500).
- `server/test/account.test.js > PATCH /api/me/profile > changes username and returns new token` passes (returns 200, not 500).
- `pnpm test` from `game/` completes with zero failed test files (full coverage run).

## Technical Specs

- `game/server/users.js` — change `saveUsers()` to write to a uniquely named temp file (e.g. `${usersFilePath}.${process.pid}.${Date.now()}.tmp`) before `renameSync` to `usersFilePath`; unlink the temp file on failure if needed.
- `game/server/test/helpers.js` (preferred) or inline in each suite — add `setServerUsersFilePath(filePath)` that calls `setTestFilePath` on `createRequire(import.meta.url)('../users.js')` (CJS instance) and optionally mirrors to the ESM import when tests need direct module access.
- `game/server/test/cosmetic_runtime.test.js` — replace ESM-only `setTestFilePath` setup with the CJS-aware helper before `startTestServer()`.
- `game/server/test/account.test.js` — same CJS-aware isolation in `beforeEach`.
- `game/server/test/auth.test.js` — same change if it still uses ESM-only `setTestFilePath` with HTTP routes (prevents future flakes).

## Verification: code
