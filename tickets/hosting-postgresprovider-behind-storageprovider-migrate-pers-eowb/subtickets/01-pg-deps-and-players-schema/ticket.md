# pg dependencies and players table schema

Add the `pg` driver and `pg-mem` test harness dependency, plus an idempotent SQL schema for the shared `players` persistence table. This sub-ticket lays the database foundation PostgresProvider will use; no provider class or server wiring yet.

## Acceptance Criteria

- `game/server/package.json` lists `pg` under `dependencies` and `pg-mem` under `devDependencies` (lockfile updated via `pnpm install` in `game/`).
- `game/server/migrations/001_players.sql` defines a `players` table with `player_id TEXT PRIMARY KEY` (the safe account/player id) and `data JSONB NOT NULL` (full persisted player blob); optional `updated_at` timestamp is fine.
- A small module (e.g. `game/server/db/ensurePlayersSchema.js`) exports the SQL text and an `ensurePlayersSchema(pool)` helper that runs the migration idempotently (`CREATE TABLE IF NOT EXISTS` or equivalent).
- `game/server/test/players_schema.test.js` boots a `pg-mem` database, applies the schema via the helper, and asserts the table exists and accepts a sample `INSERT`/`SELECT` round-trip — no live `DATABASE_URL` required.

## Technical Specs

- **`game/server/package.json`** — add `pg` and `pg-mem`; run install from `game/` workspace root.
- **`game/server/migrations/001_players.sql`** — single-table schema keyed by `player_id`; store the full player JSON document in `data`.
- **`game/server/db/ensurePlayersSchema.js`** (new) — read or inline the SQL; export `ensurePlayersSchema(pool)` callable with a `pg` `Pool` or pg-mem-backed pool.
- **`game/server/test/players_schema.test.js`** (new) — use `pg-mem` `newDb().adapters.createPg()` (or equivalent) to obtain a pool, call `ensurePlayersSchema`, verify table + insert/select.

## Verification: code
