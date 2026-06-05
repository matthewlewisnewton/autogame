# 04 — Client reconciliation for slim stateUpdate

Update the client so UI and authoritative local state no longer depend on cold fields arriving on every `stateUpdate`. Deck, hand, and inventory must stay in sync via `deckUpdate`, `cardInventoryUpdate`, `lobbyJoined`, and full snapshots on phase transitions.

## Acceptance Criteria

- `stateUpdate` handler in `main.js` does not read removed cold fields (`deck`, `hand`, `desperationDeck`, `inventory`, `selectedDeck`, `ownedCards`, `runRewards`, `returnRewardsPreview`, `inDesperation`, `nextDrawAt`) for HUD or hand reconciliation when they are absent from the payload.
- Extended `deckUpdate` handler applies in-run changes: updates local `hand` array, draw-pile/desperation state, deck stack visuals, and `updateDeckStats` using payload fields.
- `syncLocalCollectionState` no longer treats missing `inventory`/`selectedDeck`/`ownedCards` on tick updates as a regression; collection state continues to update from `deckUpdate`, `cardInventoryUpdate`, `lobbyJoined`, and full `stateUpdate` on lobby/phase transitions.
- Level-settings `returnRewardsPreview` UI still works (derive from `deckUpdate` `runRewards` payload, a one-shot full snapshot, or a dedicated field on `deckUpdate`).
- No deck-editor, shop, forge, or in-run hand HUD desync after deploy, card play, passive draw, sell/buy, or reconnect (covered by existing integration tests plus any new assertions).

## Technical Specs

- **`game/client/main.js`**
  - `stateUpdate` handler (~953–1036): guard hot-path reads (`updateDeckStats`, hand reconciliation, `syncDrawPileFromServer`, `syncLocalCollectionState`) so they skip or fall back when cold fields are undefined; prefer last-known values from `deckUpdate`.
  - `deckUpdate` handler (~1163–1175): merge `hand`, `deck`, `desperationDeck`, `inDesperation`, `nextDrawAt`, `runRewards`, `returnRewardsPreview` when present; call `renderHand`, `updateDeckVisuals`, `syncDrawPileFromServer`, `updateDeckStats` during `gamePhase === 'playing'`.
  - `syncLocalCollectionState` (~1537–1558): only overwrite `myInventory` / `mySelectedDeck` / `myOwnedCards` when the incoming player object actually includes those arrays/objects.
  - `syncLevelSettingsRewards` / extracted overlay (~399): read preview from `deckUpdate` or `gameState.players[myId]` when full snapshot supplies it.
- **`game/server/test/integration.test.js`**
  - Update assertions that expect `deck`/`hand` on every tick `stateUpdate` if they listen to the game loop; allow cold data via `deckUpdate` instead.

## Verification: code
