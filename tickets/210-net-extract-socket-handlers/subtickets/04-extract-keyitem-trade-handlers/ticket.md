# 04 — Extract key-item and trade socket handlers

Move key-item equip/use and player-to-player card trade socket events into dedicated modules, mirroring the thin delegation pattern already used for `useCard` → `cardEffects.handleUseCard`.

## Acceptance Criteria

- `game/server/socketHandlers/keyItemHandlers.js` exports `register(socket, ctx)` registering `equipKeyItem` and `useKeyItem` (the latter delegates to `keyItemEffects.handleUseKeyItem` exactly as today).
- `game/server/socketHandlers/tradeHandlers.js` exports `register(socket, ctx)` registering `offerCardTrade` and `respondCardTrade`, preserving trade resolution notifications via `findSocketByPlayerId`.
- The connection closure calls both `register` functions; four handler bodies are removed from `index.js`.
- Server tests pass for key items and trades (`game/server/test/key-items.test.js`, trade-related cases in `game/server/test/integration.test.js`).

## Technical Specs

- **`game/server/socketHandlers/keyItemHandlers.js`** (new): `equipKeyItem` lobby guard and `getKeyItemDef` validation; `useKeyItem` one-liner delegating to `keyItemEffects.handleUseKeyItem(socket, state, lobby, data)` inside `ctx.withLobbyFromSocket`.
- **`game/server/socketHandlers/tradeHandlers.js`** (new): move `offerCardTrade` / `respondCardTrade` logic including local `notifyTradeResolved` helper; use `ctx.findSocketByPlayerId`, `ctx.savePlayerData`, progression trade functions from `./progression`.
- **`game/server/index.js`**: wire both modules; remove four inlined handlers.
- **`game/server/socketHandlers/index.js`**: re-export both modules.

## Verification: code
