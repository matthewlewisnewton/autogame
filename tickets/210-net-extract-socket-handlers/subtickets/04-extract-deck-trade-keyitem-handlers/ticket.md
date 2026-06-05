# 04 — Extract deck, trade, and key-item socket handlers

Move all lobby-phase inventory/deck/trade/key-item socket handlers out of `index.js` into focused modules, continuing the `register(socket, ctx)` pattern. `useCard` / `useKeyItem` effect dispatch stays delegated to `cardEffects` / `keyItemEffects` as today.

## Acceptance Criteria

- `game/server/socketHandlers/deck.js` exports `register(socket, ctx)` for: `deckAddCard`, `deckRemoveCard`, `evolveCard`, `sellCard`, `unlockHat`, `medicHeal`, `grindCard`.
- `game/server/socketHandlers/trade.js` exports `register(socket, ctx)` for: `offerCardTrade`, `respondCardTrade` (including `findSocketByPlayerId` trade notifications).
- `game/server/socketHandlers/keyItem.js` exports `register(socket, ctx)` for: `equipKeyItem`, `useKeyItem` (thin wrapper calling `keyItemEffects.handleUseKeyItem`).
- `registerAll` wires all three modules.
- No inline `socket.on` for those eleven events remains in `game/server/index.js`.
- `cd game && pnpm test:quick` passes, including `game/server/test/key-items.test.js` equip/use coverage.

## Technical Specs

- **New:** `game/server/socketHandlers/deck.js` — move handlers ~L1420–1723 (post–sub-ticket 02, line numbers may shift).
- **New:** `game/server/socketHandlers/trade.js` — move handlers ~L1725–1826.
- **New:** `game/server/socketHandlers/keyItem.js` — move handlers ~L1478–1506.
- **Edit:** `game/server/socketHandlers/ctx.js` — expose `withLobbyPlayer`, `findSocketByPlayerId`, progression/deck helpers used by these handlers.
- **Edit:** `game/server/socketHandlers/index.js` — register deck, trade, keyItem.
- **Edit:** `game/server/index.js` — remove moved handler blocks; keep `cardEffects.setCallbacks` / `keyItemEffects.setCallbacks` wiring where it lives today.

## Verification: code
