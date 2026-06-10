# Extract card inventory and deck module

Move card-instance creation, inventory normalization, and deck validation out of `progression.js` into a dedicated module. These are player-scoped helpers used by persistence, economy, trades, and hand logic.

## Acceptance Criteria

- New file `game/server/progression/inventory.js` owns card-instance helpers (`createCardInstance`, `createInventoryFromCardIds`, `createInventoryFromOwnedCards`, `normalizeInventory`, `inventoryToOwnedCards`, `getInventoryInstance`, `normalizePlayerInventory`, `normalizeSelectedDeck`, `cardIdForDeckEntry`, `resolveDeckEntry`, `findAvailableInventoryInstance`, `canAddCardInstanceToDeck`, `canAddCardToDeck`, `validateDeck`, `createPlayerProgress`, `grantCard`).
- `game/server/progression/inventory.js` contains **no** module-level `_gameState`.
- `extractPersistentData` in `persistence.js` imports `normalizePlayerInventory` from `inventory.js` instead of `progression.js`.
- `game/server/progression.js` re-exports the inventory API; removed code is not duplicated.
- `pnpm test:quick` from `game/` passes (deck validation, card acquisition, and integration tests that touch inventory).

## Technical Specs

- **Create** `game/server/progression/inventory.js` — move the functions listed above plus related constants they need (`STARTING_DECK_IDS`, `DECK_MIN_SIZE`/`DECK_MAX_SIZE` imports from `config`).
- **Edit** `game/server/progression/persistence.js` — import `normalizePlayerInventory` from `./inventory`.
- **Edit** `game/server/progression.js` — delete moved implementations; re-export from `./progression/inventory`.
- Leave shop/economy, trades, hand, and run-lifecycle functions in `progression.js` for later sub-tickets; only relocate inventory/deck concerns here.

## Verification: code
