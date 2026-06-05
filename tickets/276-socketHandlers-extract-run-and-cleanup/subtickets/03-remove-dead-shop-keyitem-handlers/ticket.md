# 03 — Remove dead buyShopCard and listKeyItems socket handlers

Remove socket handlers that the client no longer emits. The shop UI renders offers from lobby `gameState.shopOffer` but has no wired `buyShopCard` emit; key items are delivered on the `init` payload as `keyItemDefs`, so `listKeyItems` is unused. Delete the dead handlers and their socket-level tests while keeping underlying progression helpers (`buyShopCard` function, `getUnlockedKeyItems`) intact for direct unit tests.

## Acceptance Criteria

- No `socket.on('buyShopCard', …)` registration exists anywhere under `game/server/socketHandlers/`.
- No `socket.on('listKeyItems', …)` registration exists anywhere under `game/server/socketHandlers/`.
- `deckHandlers.js` no longer imports or references the `buyShopCard` progression helper unless still needed elsewhere in that file.
- `keyItemHandlers.js` no longer reads `getUnlockedKeyItems` from `ctx`.
- `index.js` `ctx` omits `getUnlockedKeyItems` if nothing else in the handler chain needs it.
- Socket integration tests that only exercised the removed events are deleted or updated; remaining tests pass:
  - Remove/adjust `describe('listKeyItems socket handler', …)` in `game/server/test/key-items.test.js`.
  - Remove/adjust `buyShopCard` socket integration cases in `game/server/test/integration.test.js`.
- Direct unit tests of `buyShopCard(player, offer)` in `game/server/test/server.test.js` and `getUnlockedKeyItems()` in `key-items.test.js` remain and still pass.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/deckHandlers.js`
  - Delete the `buyShopCard` `socket.on` handler (~L182–198) and drop `buyShopCard` from progression imports if unused.
- **Edit:** `game/server/socketHandlers/keyItemHandlers.js`
  - Delete the `listKeyItems` `socket.on` handler (~L10–18) and remove `getUnlockedKeyItems` from `ctx` destructuring.
- **Edit:** `game/server/index.js`
  - Remove `getUnlockedKeyItems` from the connection `ctx` object if no remaining handler module consumes it.
- **Edit:** `game/server/test/key-items.test.js`
  - Remove the `listKeyItems socket handler` describe block (~L134+); keep `getUnlockedKeyItems()` unit tests.
- **Edit:** `game/server/test/integration.test.js`
  - Remove socket `buyShopCard` integration tests (~L3247–3288); keep unrelated shop/state coverage if present.
- Do not delete `buyShopCard` or `getUnlockedKeyItems` from `progression.js` exports.

## Verification: code
