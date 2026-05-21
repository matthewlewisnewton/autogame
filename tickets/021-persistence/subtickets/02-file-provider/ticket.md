# Implement In-Memory and File-Based Storage Providers

Create two concrete implementations of `StorageProvider`: an `InMemoryProvider` (for testing/development) and a `FileProvider` (for production use). The `FileProvider` writes player data to a JSON file on disk with atomic saves (write to temp file, then rename) to prevent corruption on crash.

## Acceptance Criteria
- A new file `game/server/providers.js` exists with two exported classes: `InMemoryProvider` and `FileProvider`, both extending `StorageProvider`.
- `InMemoryProvider` stores data in a plain JavaScript `Map` keyed by `playerId`. `savePlayer()` writes to the map, `loadPlayer()` reads from it, `close()` is a no-op.
- `FileProvider` constructor accepts a `basePath` string (directory path). Player data is stored as individual JSON files at `{basePath}/{playerId}.json`.
- `FileProvider.savePlayer()` writes to a `.tmp` file first, then atomically renames to the final `.json` file (crash safety).
- `FileProvider.loadPlayer()` reads and parses the JSON file, returning `null` if the file does not exist.
- `FileProvider.close()` is a no-op (no open handles to release).
- The data shape persisted is: `{ currency, ownedCards, selectedDeck }`.
- The `basePath` directory is created automatically if it does not exist (using `fs.mkdirSync` with `{ recursive: true }`).

## Technical Specs
- **New file**: `game/server/providers.js`
- Import `StorageProvider` from `./storage.js`.
- Use Node.js built-in `fs` and `path` modules — no new npm dependencies.
- `FileProvider.savePlayer()`: use `fs.writeFileSync(tmpPath, json)` then `fs.renameSync(tmpPath, finalPath)` for atomicity.
- `FileProvider.loadPlayer()`: use `fs.readFileSync(path, 'utf-8')` wrapped in try/catch; return `null` on `ENOENT`.

## Verification: code
