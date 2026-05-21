# Unit Tests for Persistence Layer

Add unit tests for the storage interface, both providers, and the persistence wiring in the server. Tests verify that `InMemoryProvider` and `FileProvider` correctly save and load player data, that the abstract `StorageProvider` throws on direct use, and that `extractPersistentData` / `savePlayerData` work as expected.

## Acceptance Criteria
- A new test file `game/server/test/persistence.test.js` exists with at least 8 passing tests.
- Test coverage includes:
  - `StorageProvider` base class: calling `savePlayer`, `loadPlayer`, or `close` throws an error.
  - `InMemoryProvider`: `savePlayer()` then `loadPlayer()` returns the same data; `loadPlayer()` for unknown id returns `null`.
  - `FileProvider`: `savePlayer()` then `loadPlayer()` returns the same data; `loadPlayer()` for unknown id returns `null`; `close()` is a no-op; data survives across separate `FileProvider` instances (write with one, read with another).
  - `extractPersistentData`: returns an object with `currency`, `ownedCards`, `selectedDeck` from a player object.
  - `savePlayerData`: calls `provider.savePlayer` with the correct data shape; catches and logs errors without rethrowing.
- All existing tests continue to pass (no regressions).

## Technical Specs
- **New file**: `game/server/test/persistence.test.js`
- Import `StorageProvider` from `../storage.js`, providers from `../providers.js`.
- Import server exports (`extractPersistentData`, `savePlayerData`, `gameState`) from `../index.js` (or mock a provider for `savePlayerData` tests).
- For `FileProvider` tests, use a temp directory under `game/server/test/__fixtures__/` or `os.tmpdir()` and clean up after each test.
- Use the same vitest setup as existing server tests (`describe`, `it`, `expect`).

## Verification: code
