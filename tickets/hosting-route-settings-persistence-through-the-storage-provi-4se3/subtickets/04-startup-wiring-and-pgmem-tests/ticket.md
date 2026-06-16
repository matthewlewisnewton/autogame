# Wire settings provider at startup and add pg-mem tests

Call `initSettingsWithProvider()` from `index.js` after the StorageProvider is initialized so settings go through the provider at runtime. Add pg-mem tests to verify settings round-trip through PostgresProvider. Ensure all existing settings tests still pass.

## Acceptance Criteria

- `index.js` calls `initSettingsWithProvider(getProvider())` after the provider is set (after `setTestProvider(...)` and before `io.removeAllListeners`)
- `initSettingsPath(dataPath)` is still called for test backward compatibility (existing tests use it)
- New pg-mem test cases in `postgres_provider.pgmem.cjs` verify: `saveSettings`/`loadSettings` round-trip, `null` for unknown accountId, overwrite on subsequent save, isolation between accounts, UUID-shaped accountIds, and traversal rejection
- All existing vitest settings tests (`settings.test.js`) pass without modification
- Full test suite (`pnpm test`) passes

## Technical Specs

- **File**: `game/server/index.js`
  - After the `setTestProvider(...)` block (around line 1886), add:
    ```js
    const { initSettingsWithProvider } = require('./settings');
    initSettingsWithProvider(getProvider());
    ```
  - Keep the existing `initSettingsPath(dataPath)` call for backward compat with tests
- **File**: `game/server/test/postgres_provider.pgmem.cjs`
  - Import `SETTINGS_SCHEMA_SQL` from `ensurePlayersSchema.js`
  - Extend `createProvider()` to also apply settings schema: `db.public.none(SETTINGS_SCHEMA_SQL)`
  - Add test cases for settings using a sample settings object matching `getDefaultSettings()` shape:
    - `'stores and retrieves settings'` — saveSettings then loadSettings returns same data
    - `'returns null for unknown account'` — loadSettings('nonexistent') returns null
    - `'overwrites settings on subsequent saves'` — second saveSettings overwrites first
    - `'isolates settings between accounts'` — two accounts have independent settings
    - `'accepts UUID-shaped accountIds for settings'`
    - `'rejects traversal accountId on settings save'`
    - `'rejects traversal accountId on settings load'`

## Verification: code
