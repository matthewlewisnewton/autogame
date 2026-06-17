# Async admin roster, Postgres startup, and full-suite cleanup

Finish the migration by awaiting the remaining provider call site (`admin.js:38`), making Postgres production startup use the async provider factory, and updating e2e/scripts that referenced deasync. The full server test suite must pass with no deasync anywhere in the repo.

## Acceptance Criteria

- `admin.js:38` — `provider.loadPlayer(accountId)` is awaited inside `async function buildAdminRoster`; `adminHandler` awaits it before rendering HTML.
- `index.js` Postgres init (`PERSISTENCE_BACKEND=postgres`) uses `await PostgresProvider.create(databaseUrl)` (or equivalent) instead of a synchronous `new PostgresProvider(...)` constructor that blocked on schema migration.
- `startServer` (and the `require.main === module` bootstrap) can complete Postgres provider initialization without deadlocking; tests using `startServer(0)` with InMemory/File backends still work synchronously or via `await startServer(0)` as needed.
- `game/server/e2e/postgres.e2e.cjs` uses `async`/`await` on provider methods; comments no longer cite deasync as the reason for top-level-only execution.
- `game/scripts/run-e2e.sh` comment about deasync is removed or updated.
- `game/server/test/admin_roster.test.js` passes with `await buildAdminRoster()`.
- Full harness check passes: `pnpm test` (or `pnpm test:quick`) in `game/` with zero deasync references in source, lockfile, or workspace config.

## Technical Specs

- **`game/server/admin.js`**
  - `buildAdminRoster` → `async`; `persisted = await provider.loadPlayer(accountId)` inside the existing try/catch.
  - `adminHandler` → `async (req, res)`; `const roster = await buildAdminRoster()`.
- **`game/server/index.js`**
  - `startServer` → `async function startServer(port)` (return a Promise that resolves when listening + provider init complete).
  - Postgres branch: `setTestProvider(await providers.PostgresProvider.create(databaseUrl))`.
  - `require.main` block: `startServer().catch(err => { console.error(err); process.exit(1); })`.
  - Update test exports if tests import `startServer` — callers in `game/server/test/helpers.js` and suites should `await startServer(0)` where needed.
- **`game/server/e2e/postgres.e2e.cjs`** — wrap scenarios in `async` IIFE; `await provider.savePlayer` / `loadPlayer` / `close`.
- **`game/scripts/run-e2e.sh`** — drop deasync justification comment.
- **`game/server/test/admin_roster.test.js`** — `await buildAdminRoster()`; adjust HTTP handler tests if they hit `/admin`.
- **`game/server/test/helpers.js`** (and any shared `startTestServer` helper) — propagate `await startServer(0)` so Postgres-path tests do not race provider init.
- Sweep remaining tests that call `provider.loadPlayer` / `savePlayer` / `loadSettings` / `saveSettings` synchronously (e.g. `hat_unlock_persistence.test.js`, `appearance_change_persistence.test.js`, `integration.test.js` provider reads) and add `await`.

## Verification: code
