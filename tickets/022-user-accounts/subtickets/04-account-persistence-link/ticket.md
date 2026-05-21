# Link Account ID to Persistence Layer

Change the persistence layer so that when a player is authenticated (has an `accountId`), their saved data is keyed by `accountId` instead of the ephemeral `playerId`. This ensures the same account loads the same character across devices and browser sessions. Anonymous players continue using their random UUID.

## Acceptance Criteria
- When a player connects with a valid JWT (authenticated), `savePlayerData()` persists data using the player's `accountId` as the key in the storage provider.
- When a player connects without a token (anonymous), `savePlayerData()` persists data using the random `playerId` as the key (existing behavior preserved).
- On reconnect with a valid JWT, `loadPlayer()` loads data using the `accountId` — the player sees their previous currency, ownedCards, selectedDeck, and location.
- The player object in `gameState.players` stores an `accountId` field (set from JWT on connect; `null` for anonymous).
- `accountId` is included in the `init` event payload so the client can display the logged-in username.
- Unit tests verify: authenticated save/load round-trip by accountId, anonymous save/load by playerId, and that the `init` payload contains `accountId`.

## Technical Specs
- **Modify**: `game/server/index.js` — in the `io.on('connection')` handler:
  - Set `socket.accountId` from decoded JWT (or `null` for anonymous).
  - On player init, set `player.accountId = socket.accountId`.
  - In `init` emit, include `accountId: player.accountId`.
- **Modify**: `game/server/index.js` — update `savePlayerData(playerId)` to look up `gameState.players[playerId].accountId` and use that as the key for `provider.savePlayer()`. Fall back to `playerId` when `accountId` is `null`.
- **Modify**: `game/server/index.js` — update the load-on-connect path: when `accountId` is present, call `provider.loadPlayer(accountId)` instead of `provider.loadPlayer(playerId)`.

## Verification: code
