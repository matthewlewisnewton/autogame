# Async StorageProvider interface and concrete providers

Replace the synchronous `runSync`/`deasync` bridge with a uniformly async `StorageProvider` API across `InMemoryProvider`, `FileProvider`, and `PostgresProvider`. Remove the `deasync` dependency entirely and rewrite provider unit tests (including Postgres/pg-mem) to `await` methods directly inside vitest — no child-process workarounds.

## Acceptance Criteria

- `game/server/providers.js` contains no `deasync`, no `runSync`, and no `require('deasync')`.
- `deasync` is removed from `game/server/package.json` dependencies and from `game/pnpm-workspace.yaml` `allowBuilds`.
- `game/server/storage.js` declares async methods (`savePlayer`, `loadPlayer`, `saveSettings`, `loadSettings`, `close`) that return Promises.
- All three concrete providers implement the async interface: Postgres uses plain `await this.pool.query(...)`; InMemory/File wrap their existing sync bodies in `async` methods (no busy-spin).
- `PostgresProvider` schema bootstrap (`ensurePlayersSchema` / `ensureSettingsSchema`) is awaited without blocking the event loop — e.g. a `static async create(...)` factory used when `skipSchemaEnsure` is false, while the injectable-pool test constructor keeps `skipSchemaEnsure: true`.
- `game/server/test/providers.test.js`, the InMemory/File sections of `game/server/test/persistence.test.js`, and `game/server/test/postgres_provider.test.js` pass with `await` on every provider call.
- Postgres provider tests run natively in vitest against pg-mem (delete or inline `postgres_provider.pgmem.cjs`; no `spawnSync` child-process runner and no comment citing deasync deadlock as the reason).

## Technical Specs

- **`game/server/storage.js`** — change abstract method stubs to `async` functions that still throw `Not implemented` (or return rejected Promises).
- **`game/server/providers.js`**
  - Delete `runSync` and the `deasync` import.
  - `InMemoryProvider` / `FileProvider`: mark all persistence methods and `close` as `async`; keep existing logic unchanged inside the method bodies.
  - `PostgresProvider`: `async savePlayer/loadPlayer/saveSettings/loadSettings/close`; replace every `runSync(this.pool.query(...))` with `await this.pool.query(...)`.
  - Move constructor-time schema ensure into `static async create(databaseUrlOrOptions, options)` (or equivalent) that constructs the pool then `await`s `ensurePlayersSchema` / `ensureSettingsSchema` when not skipped.
- **`game/server/package.json`** — remove `deasync` from `dependencies`.
- **`game/pnpm-workspace.yaml`** — remove the `deasync: true` `allowBuilds` entry.
- **`game/server/test/providers.test.js`** — convert all provider calls to `async` tests with `await`.
- **`game/server/test/persistence.test.js`** — update only the `StorageProvider` abstract-class tests and InMemory/File provider describe blocks (not `savePlayerData` integration yet).
- **`game/server/test/postgres_provider.test.js`** — rewrite as standard vitest `async` tests using pg-mem (`newDb`, injected `Pool`, `skipSchemaEnsure: true` + manual schema SQL as today).
- **`game/server/test/postgres_provider.pgmem.cjs`** — delete once cases are ported, or reduce to a shared helper imported by the vitest file.

## Verification: code
