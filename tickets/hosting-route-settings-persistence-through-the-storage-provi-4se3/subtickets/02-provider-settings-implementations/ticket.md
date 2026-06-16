# Implement settings methods in InMemoryProvider, FileProvider, PostgresProvider

Implement `saveSettings`/`loadSettings` in all three concrete providers. InMemory uses a separate Map, FileProvider writes to a `settings/` subdirectory, and PostgresProvider uses a new `settings` table (migration `002_settings.sql`).

## Acceptance Criteria

- **InMemoryProvider**: `saveSettings`/`loadSettings` use a separate `Map` (independent from `this.store`); round-trip store/retrieve works; returns `null` for unknown accountId
- **FileProvider**: `saveSettings` writes to `{basePath}/settings/{accountId}.json` with atomic tmp+rename; `loadSettings` reads same path; returns `null` on ENOENT; accountId validated against `SAFE_PLAYER_ID_REGEX`
- **PostgresProvider**: `saveSettings` upserts into `settings` table (`account_id`, `data` jsonb, `updated_at`); `loadSettings` selects by `account_id`; returns `null` when no row; accountId validated against `SAFE_PLAYER_ID_REGEX`
- **Migration**: `002_settings.sql` creates `settings` table with `account_id TEXT PRIMARY KEY`, `data JSONB`, `updated_at TIMESTAMP`
- **Schema ensure**: `ensurePlayersSchema.js` exports a new `ensureSettingsSchema(pool)` function (or extends existing) to idempotently create the settings table; PostgresProvider constructor calls it unless `skipSchemaEnsure` is true

## Technical Specs

- **Files to change**:
  - `game/server/providers.js` — add `saveSettings`/`loadSettings` to `InMemoryProvider`, `FileProvider`, `PostgresProvider`
  - `game/server/migrations/002_settings.sql` — CREATE TABLE settings
  - `game/server/db/ensurePlayersSchema.js` — add `ensureSettingsSchema()` and export `SETTINGS_SCHEMA_SQL`; call from PostgresProvider constructor
- PostgresProvider `saveSettings` uses `INSERT ... ON CONFLICT (account_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`
- FileProvider reuses the same atomic-write pattern as `savePlayer` (tmp file + rename)
- InMemoryProvider stores settings in `this.settingsStore = new Map()`

## Verification: code
