# Senior Review — Hosting: PostgresProvider behind StorageProvider

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block. Servers started, scene initialized, full smoke flow (auth → lobby → ready → movement → dodge w/ cooldown) captured cleanly.
- `console.log`: only benign noise — vite ws connect lines, a 409 on a resource (pre-existing idempotent-create response, not from this ticket), and Three.js init logs. No `pageerror` / `[fatal]` from game code.
- **Game runs and loads cleanly.** Gate passes.

## Acceptance criteria

The ticket has one compound AC. Each clause assessed:

### PostgresProvider implements StorageProvider
PASS. `game/server/providers.js` adds `class PostgresProvider extends StorageProvider` implementing `savePlayer`, `loadPlayer`, and `close` — the full synchronous interface from `game/server/storage.js`. The interface was not changed.

### Round-trips savePlayer/loadPlayer via pg-mem in tests
PASS. `server/test/postgres_provider.pgmem.cjs` drives the provider against `pg-mem`'s in-memory adapter (`db.adapters.createPg()`), covering store/retrieve, unknown-key → `null`, overwrite, multi-player isolation, deep-copy on save and load, traversal-id rejection on both save and load, and UUID acceptance. Driven from vitest via child processes (`postgres_provider.test.js`) because `deasync` blocks vitest workers — a documented, sound workaround. 11 cases, all green.

### PERSISTENCE_BACKEND=postgres selects it and DATABASE_URL is honored
PASS. `server/index.js:1824` adds the `postgres` branch in `startServer`, constructing `PostgresProvider(databaseUrl)`. `persistence_backend.test.js` verifies the constructor receives the exact `DATABASE_URL`, that a missing or whitespace-only `DATABASE_URL` throws *before* the server listens, and the log line is emitted.

### FileProvider and InMemoryProvider unchanged with passing tests
PASS. The diff to `providers.js` only adds `runSync`, `PostgresProvider`, and the export list; `InMemoryProvider`/`FileProvider` bodies are untouched. Default (unset) still selects FileProvider, `memory` still selects InMemoryProvider, and `NODE_ENV=test` still keeps InMemoryProvider / honors an injected provider — all asserted.

### Full suite runs with no live DB
PASS. Ran `vitest run --project server`: **197 files, 2758 tests, all passing** in ~34s with no `DATABASE_URL` set. The pg-mem path and the env-selection tests (which mock the constructor) require no live Postgres.

## Design / foundation consistency

- Schema (`migrations/001_players.sql`) is a single `players` table keyed by `player_id` with a `JSONB data` blob and `updated_at`, matching the ticket's "players table keyed by safe accountId/playerId" intent. `ensurePlayersSchema` applies it idempotently via an `information_schema` existence check.
- Path-traversal guard preserved: both `savePlayer` and `loadPlayer` call `assertSafePlayerId` before touching the DB, and tests confirm `../`, separators, dots, and empty ids are rejected.
- Upsert uses parameterized `INSERT ... ON CONFLICT DO UPDATE` (no SQL injection surface). Data is deep-copied on both write and read, matching FileProvider semantics so callers can't mutate stored state.
- No regression to `requirements.md` foundation; the smoke capture exercised normal gameplay end-to-end. No debug scenarios were added by this ticket.

## Remaining gaps

None blocking. One architectural follow-up noted in `nits.md`: the `deasync` bridge blocks the entire Node event loop for the duration of each DB round-trip, which partially works against the scalability goal of the ticket. It is the pragmatic choice given the synchronous `StorageProvider` interface the ticket forbids changing, and it does not affect correctness or the acceptance criteria — hence a follow-up, not a blocker.

VERDICT: PASS
