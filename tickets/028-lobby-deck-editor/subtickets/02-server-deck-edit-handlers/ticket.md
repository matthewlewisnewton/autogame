# Server Deck Edit Handlers

Add Socket.IO handlers for `deckAddCard` and `deckRemoveCard` that let a player modify their selected deck while in the lobby. The server validates every edit and responds with success or error.

## Acceptance Criteria
- The server listens for `deckAddCard` events with payload `{ cardId }`.
- The server listens for `deckRemoveCard` events with payload `{ cardId }`.
- On valid add: the card id is appended to `player.selectedDeck`, and the server emits `deckUpdate` back to the player with `{ selectedDeck, ownedCards }`.
- On valid remove: one occurrence of the card id is removed from `player.selectedDeck`, and the server emits `deckUpdate`.
- On invalid add (unknown card, too many copies, deck full): the server emits `deckError` with a reason string and does NOT modify the deck.
- On invalid remove (card not in deck): the server emits `deckError` and does NOT modify the deck.
- Deck edits are rejected if `gameState.gamePhase === 'playing'` (only allowed in lobby).
- Integration test: two players can edit their decks independently without affecting each other.
- Integration test: deck edit events in playing phase are silently ignored.

## Technical Specs
- **File**: `game/server/index.js`
  - Add `socket.on('deckAddCard', ...)` handler:
    - Guard: reject if `gameState.gamePhase !== 'lobby'`
    - Validate `cardId` exists in `CARD_DEFS`
    - Call `canAddCardToDeck(cardId, player.selectedDeck, player.ownedCards)` — if false, emit `deckError` with reason
    - On success: `player.selectedDeck.push(cardId)`, emit `deckUpdate` to the socket with `{ selectedDeck: player.selectedDeck, ownedCards: player.ownedCards }`
  - Add `socket.on('deckRemoveCard', ...)` handler:
    - Guard: reject if `gameState.gamePhase !== 'lobby'`
    - Find index of `cardId` in `player.selectedDeck`; if not found, emit `deckError`
    - On success: `player.selectedDeck.splice(idx, 1)`, emit `deckUpdate`
  - Both handlers emit to the individual socket (`socket.emit`), not broadcast.
- **File**: `game/server/test/integration.test.js`
  - Test: player A adds a card, receives `deckUpdate` with updated deck; player B's deck is unchanged.
  - Test: player sends `deckAddCard` during playing phase, deck is unchanged.
  - Test: adding unknown card emits `deckError`.
  - Test: removing card not in deck emits `deckError`.

## Verification: code
