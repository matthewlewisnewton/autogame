# Users Postgres schema and ensureUsersSchema

Add the `users` table migration and an idempotent schema-bootstrap helper, mirroring the existing `players` and `settings` tables. This lays the database foundation for shared credential storage; no provider methods or `users.js` changes yet.

## Acceptance Criteria

- `game/server/migrations/003_users.sql` creates a `users` table with `username TEXT PRIMARY KEY`, `account_id TEXT UNIQUE NOT NULL`, `data JSONB NOT NULL`, and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `ensureUsersSchema(pool)` in `game/server/db/ensurePlayersSchema.js` applies `003_users.sql` only when the table is missing (idempotent, same pattern as `ensurePlayersSchema` / `ensureSettingsSchema`)
- `USERS_SCHEMA_SQL` is exported alongside the other schema SQL constants
- pg-mem tests in `game/server/test/players_schema.test.js` (or a sibling test file) verify: table creation is idempotent, a sample user document round-trips via SQL insert/select, and `account_id` uniqueness is enforced

## Technical Specs

- **File:** `game/server/migrations/003_users.sql`
  - `CREATE TABLE IF NOT EXISTS users (...)` with columns above; store the full user record (passwordHash, cosmetic, unlockedHats, unlockedQuestTiers, completedQuestTiers, optional email) inside `data` jsonb
- **File:** `game/server/db/ensurePlayersSchema.js`
  - Read `003_users.sql`; add `ensureUsersSchema(pool)`; export `USERS_SCHEMA_SQL`
- **File:** `game/server/test/players_schema.test.js`
  - Add a `users schema` describe block using pg-mem + `ensureUsersSchema`, following the existing settings schema tests

## Verification: code
