# Extend StorageProvider interface with settings methods

Add `saveSettings(accountId, data)` and `loadSettings(accountId)` abstract methods to the `StorageProvider` base class. These mirror `savePlayer`/`loadPlayer` but are semantically separate — settings are per-account preferences, not gameplay state.

## Acceptance Criteria

- `StorageProvider` exports two new abstract methods: `saveSettings(accountId, data)` and `loadSettings(accountId)` (returns `null` when not found)
- Calling either method on the base `StorageProvider` throws `"Not implemented"`
- Existing `savePlayer`/`loadPlayer` methods are unchanged

## Technical Specs

- **File**: `game/server/storage.js`
  - Add `saveSettings(accountId)` and `loadSettings(accountId)` to the `StorageProvider` class body, each throwing `new Error('Not implemented')`

## Verification: code
