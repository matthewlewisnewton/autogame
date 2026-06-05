# 03 — Extract lobby deck, shop, and trade socket handlers

Move pre-run lobby UI handlers from the connection closure into `lobbyHandlers.register`. These handlers operate in lobby phase via `withLobbyPlayer` (or delegate to effect modules) and cover deck editing, shop purchases, grinding/evolution, hat unlocks, medic heal, key-item equip, and card trades.

## Acceptance Criteria

- The following handlers are registered in `lobbyHandlers.register` with no inline copies left in `index.js`:
  - `selectQuest`, `playerReady`
  - `deckAddCard`, `deckRemoveCard`, `evolveCard`, `sellCard`, `buyShopCard`, `unlockHat`, `grindCard`
  - `equipKeyItem`, `useKeyItem`, `medicHeal`
  - `offerCardTrade`, `respondCardTrade`
- Phase guards, custom `phaseMismatch` emits (`keyItemError`, `medicError`), and `playerReady`'s lack of `requirePhase` are preserved exactly.
- `useKeyItem` remains a thin delegate to `cardEffects` / key-item effects — move the registration, not effect logic.
- All emitted events (`deckUpdate`, `deckError`, `questUpdate`, `shopUpdate`, `tradeOffer`, etc.) and payload shapes unchanged.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Move handler bodies from `index.js` (~L1313–1835, excluding run-lifecycle handlers in 04 and playing-phase handlers in 05).
  - Extend `ctx` usage for helpers: `withLobbyPlayer`, `withLobbyFromSocket`, `validateDeck`, `normalizePlayerInventory`, `broadcastLobbyUpdate`, `checkAllReady`, `isLobbyPhase`, `applyLayoutForQuest`, `assignRunSpawnPositions`, `buildQuestUpdatePayload`, `stateSnapshot`, `io`, deck/inventory helpers, shop helpers, trade helpers, `cardEffects.handleUseKeyItem` (or equivalent delegate), `savePlayerData`, etc.
- **Edit:** `game/server/index.js`
  - Remove the inline `socket.on` registrations listed above.
  - Pass any additional helpers onto `ctx` at the `register` call site.
- Do not move `returnToLobby`, `giveUp`, `abandonRun`, `claimCardReward`, `move`, `useCard`, `discardCard`, `lootPickup`, `debugScenario`, `heartbeat`, or `disconnect` in this sub-ticket.

## Verification: code
