# Route settings.js through the storage provider

Refactor `settings.js` so that `getSettings()` and `updateSettings()` go through the StorageProvider's `loadSettings`/`saveSettings` methods when a provider is configured. Keep the existing file-based path as a fallback for backward compatibility with tests that use `initSettingsPath()`.

## Acceptance Criteria

- `settings.js` adds an internal `_settingsProvider` variable (initially `null`)
- `settings.js` exports `initSettingsWithProvider(provider)` to switch to provider mode; calling it sets `_settingsProvider`
- `getSettings(accountId)` routes through `_settingsProvider.loadSettings(accountId)` when provider is set (still applies `mergeWithDefaults` on the raw result); falls back to existing file I/O when no provider
- `updateSettings(accountId, partial)` routes through `_settingsProvider.saveSettings(accountId, merged)` when provider is set; falls back to existing file I/O when no provider
- Existing `initSettingsPath(basePath)` continues to work unchanged (file-based mode for tests)
- AccountId sanitization (`SAFE_ACCOUNT_ID_REGEX`) is preserved in both paths
- All existing settings tests pass without modification (they use `initSettingsPath`)

## Technical Specs

- **File**: `game/server/settings.js`
  - Add `let _settingsProvider = null;` near top
  - Add `function initSettingsWithProvider(provider) { _settingsProvider = provider; }` and export it
  - In `getSettings(accountId)`: keep existing `SAFE_ACCOUNT_ID_REGEX` check; when `_settingsProvider` is set, call `_settingsProvider.loadSettings(accountId)` instead of `fs.readFileSync(settingsFilePath(accountId))`; pass raw result through `mergeWithDefaults()` (same as today)
  - In `updateSettings(accountId, partial)`: keep existing validation; after computing `merged`, when `_settingsProvider` is set, call `_settingsProvider.saveSettings(accountId, merged)` instead of file write; still enforce `SETTINGS_MAX_BYTES` cap before saving
  - Remove `settingsFilePath` from the file I/O path when provider is active (no files written in provider mode)
  - Export `initSettingsWithProvider` in `module.exports`

## Verification: code
