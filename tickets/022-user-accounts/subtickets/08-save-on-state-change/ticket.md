# Save Player Data on State Changes

Persisted character mutations (movement/location, deck edits, loot/currency changes) are not saved when they occur — the server only saves on disconnect, terminal transitions, lobby return, or periodic autosave. Add `savePlayerData()` calls to the handlers that mutate persisted fields so that a crash between mutations and the next autosave doesn't lose player progress.

## Acceptance Criteria
- `game/server/index.js` — `socket.on('move', ...)` calls `savePlayerData(socket.playerId)` after a successful position update.
- `game/server/index.js` — `socket.on('lootPickup', ...)` calls `savePlayerData(socket.playerId)` after currency is incremented.
- `game/server/index.js` — `socket.on('deckAddCard', ...)` calls `savePlayerData(socket.playerId)` after a card is added to the deck.
- `game/server/index.js` — `socket.on('deckRemoveCard', ...)` calls `savePlayerData(socket.playerId)` after a card is removed from the deck.
- Each save call is guarded by the existing `savePlayerData()` null-safety (it checks `provider` and `player` before writing — no new guards needed).
- Unit tests verify that each handler invokes `savePlayerData` exactly once per successful mutation (using a mock provider with a `savePlayer` spy).

## Technical Specs
- **Modify**: `game/server/index.js` —
  - In `socket.on('move', ...)`: after `player.lastActivity = now;` (end of the handler, after position is set), add `savePlayerData(socket.playerId);`
  - In `socket.on('lootPickup', ...)`: after `console.log(...)` at the end of the handler, add `savePlayerData(socket.playerId);`
  - In `socket.on('deckAddCard', ...)`: after the `socket.emit('deckUpdate', ...)` call, add `savePlayerData(socket.playerId);`
  - In `socket.on('deckRemoveCard', ...)`: after the `socket.emit('deckUpdate', ...)` call, add `savePlayerData(socket.playerId);`
- **Modify**: `game/server/test/persistence_save_triggers.test.js` (new file) — integration tests that connect an authenticated player, perform each mutation (move, loot pickup, deck add, deck remove), and verify the mock provider's `savePlayer` was called with the updated persistent data. Use `setTestProvider()` to inject a mock.

## Verification: code
