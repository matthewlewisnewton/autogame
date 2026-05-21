# Define Abstract Storage Interface

Create an abstract `StorageProvider` class in `game/server/storage.js` that defines the interface all persistence backends must implement. This enables swapping the database implementation later without touching game logic.

## Acceptance Criteria
- A new file `game/server/storage.js` exists.
- The file exports a `StorageProvider` class with the following abstract methods (throwing `Error` if called directly):
  - `savePlayer(playerId, data)` — saves a player's persistent data
  - `loadPlayer(playerId)` — returns saved data or `null` if not found
  - `close()` — releases any held resources (connections, file handles)
- The `data` parameter shape is: `{ currency: number, ownedCards: object, selectedDeck: string[] }`
- The class is exported from the module so other files can extend it.
- No actual persistence (file I/O, database) is implemented in this file.

## Technical Specs
- **New file**: `game/server/storage.js`
- Export `class StorageProvider` with `savePlayer()`, `loadPlayer()`, `close()` methods that each `throw new Error('Not implemented')`.
- Keep the file under 30 lines — it's purely an interface.

## Verification: code
