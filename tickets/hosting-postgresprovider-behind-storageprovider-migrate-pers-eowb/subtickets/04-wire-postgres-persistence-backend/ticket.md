# Wire PERSISTENCE_BACKEND=postgres in startServer

Select `PostgresProvider` at server startup when `PERSISTENCE_BACKEND=postgres` and `DATABASE_URL` are set, while preserving today's defaults: `FileProvider` for durable single-instance deploys, `InMemoryProvider` when `PERSISTENCE_BACKEND=memory` or `NODE_ENV=test`.

## Acceptance Criteria

- In `startServer()` (`game/server/index.js`), when `NODE_ENV !== 'test'` and `PERSISTENCE_BACKEND === 'postgres'`, initialize `PostgresProvider` with `process.env.DATABASE_URL` via `setTestProvider`.
- If `PERSISTENCE_BACKEND=postgres` but `DATABASE_URL` is missing/empty, startup throws a clear error before accepting connections.
- When `PERSISTENCE_BACKEND` is unset (non-test), behavior remains `FileProvider` at `PERSISTENCE_PATH` / `data/` — unchanged log line.
- When `PERSISTENCE_BACKEND=memory` (non-test), behavior remains `InMemoryProvider` — unchanged.
- When `NODE_ENV=test`, behavior remains: use existing `getProvider()` if tests injected one, otherwise default `InMemoryProvider` — postgres is **not** auto-selected in tests.
- Non-test postgres init logs a line such as `[persistence] PostgresProvider initialized` (omit secrets).
- New tests in `game/server/test/persistence_backend.test.js` cover the selection matrix using env stubs and/or `pg-mem` + injectable pool; no live DB.
- Full vitest server suite passes (`pnpm test` from `game/`).

## Technical Specs

- **`game/server/index.js`**
  - Import `PostgresProvider` from `./providers`.
  - Extend the persistence block (~lines 1809–1826): add `else if (process.env.PERSISTENCE_BACKEND === 'postgres')` branch before the `FileProvider` fallback.
  - Validate `DATABASE_URL`; call `setTestProvider(new PostgresProvider(process.env.DATABASE_URL))`.
  - Do not alter auth, socket, or unrelated startup paths.
- **`game/server/test/persistence_backend.test.js`** (new)
  - Factor or spy the provider constructor if needed; set/restore `NODE_ENV`, `PERSISTENCE_BACKEND`, `DATABASE_URL` per case.
  - Cases: test mode → InMemoryProvider; `memory` → InMemoryProvider; default → FileProvider; `postgres` + URL → PostgresProvider; `postgres` without URL → throws.
  - Use `pg-mem` connection string or injectable pool so CI needs no running Postgres.
- **`game/server/providers.js`** — only if constructor signature needs a minor tweak for test injection (already added in sub-ticket 02).

## Verification: code
