# PostgresProvider pg-mem unit tests

Add a dedicated vitest suite that exercises `PostgresProvider` entirely through `pg-mem`, proving save/load round-trips and path-traversal guards without a live database. Mirrors the coverage patterns in `game/server/test/providers.test.js` for `FileProvider` and `InMemoryProvider`.

## Acceptance Criteria

- New test file `game/server/test/postgres_provider.test.js` uses only `pg-mem` (no external Postgres, no `DATABASE_URL` pointing at a real host).
- Tests cover: save then load returns equal data; `loadPlayer` returns `null` for unknown id; overwrite on second save; isolation between two player ids; save/load deep-copy semantics (mutations after save/load do not affect stored data); `close()` does not throw.
- Path-traversal hardening: `savePlayer`/`loadPlayer` reject ids like `../escaped`, `a/b`, `a.b`, empty string with `/Invalid player id/` (same as `FileProvider` tests).
- UUID-shaped player id (`550e8400-e29b-41d4-a716-446655440000`) round-trips successfully.
- `pnpm test` (vitest server suite) passes with no live DB; existing `providers.test.js` / `persistence.test.js` `FileProvider` and `InMemoryProvider` cases still pass unchanged.

## Technical Specs

- **`game/server/test/postgres_provider.test.js`** (new)
  - `beforeEach`: create `pg-mem` db → `createPg()` pool → `new PostgresProvider({ pool })` or connection-string factory that binds to the mem pool.
  - `afterEach`: `provider.close()`, dispose mem db.
  - Reuse `sampleData` shape from `providers.test.js` (`currency`, `ownedCards`, `selectedDeck`).
- **`game/server/providers.js`** — only touch if constructor needs a small test hook (injectable pool); avoid behavioral changes to `FileProvider`/`InMemoryProvider`.
- **`game/server/test/providers.test.js`** — leave `FileProvider`/`InMemoryProvider` blocks unchanged (no regressions).

## Verification: code
