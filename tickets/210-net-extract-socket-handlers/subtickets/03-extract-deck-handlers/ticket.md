# 03 — Extract deck and progression socket handlers

Move deck-editing, card progression, medic, and reward-claim socket events into a dedicated module using the shared `register(socket, ctx)` pattern.

## Acceptance Criteria

- `game/server/socketHandlers/deckHandlers.js` exports `register(socket, ctx)` that registers: `deckAddCard`, `deckRemoveCard`, `evolveCard`, `sellCard`, `grindCard`, `unlockHat`, `medicHeal`, and `claimCardReward`.
- Each handler preserves existing validation, error events (`deckError`, `cardEvolutionError`, `cardGrindError`, `hatError`, `medicError`), success payloads, and `savePlayerData` calls.
- The connection closure delegates to `deckHandlers.register(socket, ctx)`; the eight handler bodies are no longer inlined in `index.js`.
- Server tests pass for deck editing, evolution, grinding, medic heal, hat unlock, and card-reward flows (`game/server/test/card_*.test.js`, `game/server/test/hat_unlock_persistence.test.js`, `game/server/test/integration.test.js` deck sections).

## Technical Specs

- **`game/server/socketHandlers/deckHandlers.js`** (new): move handler logic verbatim; pull progression helpers from `./progression` and user/cosmetic helpers from `./users` / `./cosmetic` directly; use `ctx.withLobbyPlayer`, `ctx.withLobbyFromSocket`, `ctx.savePlayerData`, `ctx.io` (or emit helper) for broadcasts.
- **`game/server/index.js`**: import and call `deckHandlers.register(socket, ctx)`; delete the eight inlined handlers.
- **`game/server/socketHandlers/index.js`**: re-export `deckHandlers`.

## Verification: code
