# 01 — Deck handlers module scaffold and deck edit handlers

Create `game/server/socketHandlers/deckHandlers.js` with a `register(socket, ctx)` entry point and wire it from `lobbyHandlers.register`. Move `deckAddCard` and `deckRemoveCard` as the first handlers to prove the extraction pattern without touching `index.js`.

## Acceptance Criteria

- `game/server/socketHandlers/deckHandlers.js` exists and exports `register(socket, ctx)`.
- `lobbyHandlers.register` calls `deckHandlers.register(socket, ctx)`; no duplicate inline registrations for the moved handlers remain in `lobbyHandlers.js`.
- `deckAddCard` and `deckRemoveCard` handler bodies are moved verbatim from `lobbyHandlers.js` with identical phase guards (`requirePhase: 'lobby'`), validation, emitted events (`deckUpdate`, `deckError`), and `savePlayerData` calls.
- `deckHandlers.js` does not `require('./index')` or create circular imports; it reads connection helpers from `ctx` and imports deck/progression helpers directly (same pattern as `lobbyHandlers.js`).
- `index.js` is unchanged in this sub-ticket.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **New file:** `game/server/socketHandlers/deckHandlers.js`
  - Export `function register(socket, ctx) { … }`.
  - Register `deckAddCard` and `deckRemoveCard` moved from `lobbyHandlers.js` (~L219–347).
  - Import from `../config` (`DECK_MAX_SIZE`), `../progression` (`CARD_DEFS`, `normalizePlayerInventory`, `getInventoryInstance`, `cardIdForDeckEntry`, `findAvailableInventoryInstance`, `canAddCardInstanceToDeck`, `savePlayerData`).
  - Read `withLobbyPlayer` from `ctx`.
- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - `const deckHandlers = require('./deckHandlers');` near top.
  - Call `deckHandlers.register(socket, ctx)` inside `register` (after browser/quest handlers, before or alongside remaining lobby handlers).
  - Remove the inline `socket.on('deckAddCard', …)` and `socket.on('deckRemoveCard', …)` bodies and any imports now only used by those handlers.
- Do not move `playerReady`, shop, grind, evolution, or trade handlers in this sub-ticket.

## Verification: code
