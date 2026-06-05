# 03 — Extract deck inventory, evolution, grind, and shop handlers

Move card-inventory socket handlers from `lobbyHandlers.js` into `deckHandlers.js`: evolution, grinding, selling, and shop purchase. These all mutate inventory/selectedDeck and emit deck or inventory update events.

## Acceptance Criteria

- The following handlers are registered only in `deckHandlers.register` with no inline copies left in `lobbyHandlers.js`:
  - `evolveCard`
  - `grindCard`
  - `sellCard`
  - `buyShopCard`
- Phase guards (`requirePhase: 'lobby'`), progression helper calls, emitted events, and payload shapes are unchanged:
  - `evolveCard` → `cardEvolutionError` / `cardEvolutionResult` + `deckUpdate`
  - `grindCard` → `cardGrindError` / `cardGrindResult` + `deckUpdate`
  - `sellCard` / `buyShopCard` → `deckError` / `cardInventoryUpdate`
- Each successful mutation still calls `savePlayerData(socket.playerId)`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/deckHandlers.js`
  - Move handler bodies from `lobbyHandlers.js`:
    - `evolveCard` (~L349–371)
    - `sellCard` (~L373–402)
    - `buyShopCard` (~L404–420)
    - `grindCard` (~L498–522)
  - Import from `../progression`: `evolveCard`, `grindCard`, `sellCard`, `buyShopCard`, `getInventoryInstance`, `savePlayerData` (and any others the moved bodies reference).
  - Read `withLobbyPlayer` from `ctx`.
- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Remove the four handler registrations and trim imports now unused (`evolveCard`, `grindCard`, `sellCard`, `buyShopCard`, etc.).
- Do not move trade handlers or modify `index.js` in this sub-ticket.

## Verification: code
