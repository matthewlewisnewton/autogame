# Extract hand, draw deck, and desperation module

Move in-run hand management (slots, draws, discards, desperation deck, passive draw tick) out of `progression.js` into a focused module. These functions are heavily player-scoped but `processPassiveDraws` and deck-update emits still need explicit lobby `state`.

## Acceptance Criteria

- New file `game/server/progression/hand.js` owns hand/deck/desperation logic: `ensureHandSlots`, `countFilledHandSlots`, `findFirstEmptyHandSlot`, `canDrawIntoHand`, `ensurePassiveDrawScheduled`, `drawCardIntoHand`, `exhaustHandSlot`, `discardHandSlot`, `processPassiveDraws`, `isDeckEmpty`, `isDesperationDeckEmpty`, `initDesperationDeck`, `resetPlayerDesperationState`, `ensureDesperationMode`, `buildDesperationHandCard`, `drawCardFromDesperationDeck`, `recordExhaustedCard`, `createEchoCard`, `pickRandomExhaustedCard`, `replaceConsumedCard`, `beginCreatureBurnDown`, `findBurningHandCardForMinion`, `releaseBurningCreatureCard`, `createDrawDeckFromSelectedDeck`, `drawCardFromDeck`, `initPlayerHand`, `isPlayerOutOfCards`, `drawReplacementCard`, `validateUseCardHand`, `validateDiscardHand`, `discardCardFromHand`, `addMagicStones`, `restoreCardCharges`, `restoreHandCharges`, plus `DESPERATION_CARD_DEFS`, `DESPERATION_DECK_TEMPLATE`, and `getCardDef`/`CARD_DEFS` if still required by hand logic.
- `processPassiveDraws(state, now)` (or equivalent) takes lobby `state` explicitly; no `_gameState` reads inside `hand.js`.
- `game/server/progression/hand.js` contains **no** module-level `_gameState`.
- `game/server/progression.js` re-exports the hand API.
- Simulation tick path in `game/server/index.js` (or wherever `processPassiveDraws` is called) passes the active lobby `state`.
- `pnpm test:quick` from `game/` passes (card windup, hand sync, and related tests).

## Technical Specs

- **Create** `game/server/progression/hand.js` — move hand/deck/desperation functions; import `inventory.js` for deck resolution and `economy.js`/`persistence.js` only if needed for saves or grind stat overlays.
- **Edit** `game/server/progression.js` — delete moved code; re-export from `./progression/hand`; keep `emitPlayerDeckUpdate` / `buildPlayerDeckUpdatePayload` in `progression.js` temporarily if they still depend on `_gameState` for io targeting (final cleanup in sub-ticket 06).
- **Edit** `game/server/index.js` and `game/server/socketHandlers/deckHandlers.js` — pass `state` into `processPassiveDraws` and any hand validators invoked from socket handlers.
- **Edit** `game/server/cardEffects.js` or other callers of `validateUseCardHand` / `drawReplacementCard` if they call progression directly without lobby context.

## Verification: code
