# 01 — Key-item handlers module scaffold and listKeyItems

Create `game/server/socketHandlers/keyItemHandlers.js` with a `register(socket, ctx)` entry point and wire it from `lobbyHandlers.register`. Move `listKeyItems` as the first handler to prove the extraction pattern without touching `index.js`.

## Acceptance Criteria

- `game/server/socketHandlers/keyItemHandlers.js` exists and exports `register(socket, ctx)`.
- `lobbyHandlers.register` calls `keyItemHandlers.register(socket, ctx)`; no duplicate inline registration for `listKeyItems` remains in `lobbyHandlers.js`.
- `listKeyItems` handler body is moved verbatim from `lobbyHandlers.js` with identical behavior: reads `getUnlockedKeyItems` from `ctx`, maps defs to `{ id, name, description, cooldownMs }`, emits `keyItemsListed`.
- `keyItemHandlers.js` does not `require('./index')` or create circular imports; it reads connection helpers from `ctx` only.
- `equipKeyItem` and `useKeyItem` remain in `lobbyHandlers.js` for this sub-ticket.
- `index.js` is unchanged in this sub-ticket.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **New file:** `game/server/socketHandlers/keyItemHandlers.js`
  - Export `function register(socket, ctx) { … }`.
  - Register `listKeyItems` moved from `lobbyHandlers.js` (~L70–78).
  - Read `getUnlockedKeyItems` from `ctx`.
- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - `const keyItemHandlers = require('./keyItemHandlers');` near top (alongside `deckHandlers` / `tradeHandlers`).
  - Call `keyItemHandlers.register(socket, ctx)` inside `register` (alongside `deckHandlers.register` / `tradeHandlers.register`).
  - Remove the inline `socket.on('listKeyItems', …)` body.
  - Update module header comment to note key-item handlers live in `keyItemHandlers.js`.
- Do not move `equipKeyItem`, `useKeyItem`, or any non-key-item handlers in this sub-ticket.

## Verification: code
