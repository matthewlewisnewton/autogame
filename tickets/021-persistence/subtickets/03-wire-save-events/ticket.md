# Wire Persistence into Key Server Events

Integrate a `StorageProvider` instance into `game/server/index.js` so that player data is saved on key lifecycle events: disconnect, run completion (victory/failure), and returning to lobby. The server should instantiate a provider at startup (reading from `PERSISTENCE_BACKEND` env var, defaulting to `InMemoryProvider`) and call `savePlayer()` at the right moments.

## Acceptance Criteria
- `game/server/index.js` imports `InMemoryProvider` and `FileProvider` from `./providers.js`.
- A `provider` variable is initialized at server startup based on `process.env.PERSISTENCE_BACKEND`:
  - `'file'` → `new FileProvider(process.env.PERSISTENCE_PATH || './data')`
  - anything else (including undefined) → `new InMemoryProvider()`
- `extractPersistentData(player)` helper function exists that returns `{ currency, ownedCards, selectedDeck }` from a player object.
- `savePlayerData(playerId)` helper function calls `provider.savePlayer(playerId, extractPersistentData(player))` and logs errors without crashing.
- Player data is saved on these events:
  - **Disconnect**: `socket.on('disconnect')` calls `savePlayerData(socket.id)` before deleting the player from gameState.
  - **Run complete** (victory): after `grantRunRewards()` in `checkRunTerminalState()`, save all players' data.
  - **Return to lobby**: `returnPlayersToLobby()` saves all players' data before resetting transient state.
- If `savePlayerData()` throws, the error is logged with `console.error()` but does not crash the server or prevent the disconnect/lobby transition.

## Technical Specs
- **Modified file**: `game/server/index.js`
- Add `extractPersistentData(player)` near the top-level helper functions (around line 400-500, near `createPlayerProgress`).
- Add `savePlayerData(playerId)` right after it.
- Wire into `socket.on('disconnect')` — save **before** `delete gameState.players[socket.id]`.
- Wire into `checkRunTerminalState()` — save after rewards are granted, before emitting `runComplete`/`runFailed`.
- Wire into `returnPlayersToLobby()` — save after preserving currency/inventory, before resetting player positions.
- Export `extractPersistentData` and `savePlayerData` in the module.exports block for testing.

## Verification: code
