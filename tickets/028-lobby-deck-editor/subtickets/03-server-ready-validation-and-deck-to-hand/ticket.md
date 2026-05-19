# Server Ready Validation and Deck-to-Hand

Block the ready button when a player's selected deck is invalid, and use the selected deck to create the player's draw deck and initial hand when a run starts.

## Acceptance Criteria
- The `playerReady` handler checks `validateDeck(player.selectedDeck, player.ownedCards)` before accepting ready.
- If the deck is invalid, the server sets `player.ready = false`, emits `deckError` to the player with a reason, and broadcasts `lobbyUpdate`.
- The server exposes `selectedDeck` and `ownedCards` in the `init` payload so the client can render the deck editor.
- When `checkAllReady` transitions to playing, the server calls `createDrawDeckFromSelectedDeck(player)` for each player to populate `player.deck` (array of card id strings).
- `createDrawDeckFromSelectedDeck(player)` shuffles the player's `selectedDeck` card ids into a new array and assigns it to `player.deck`.
- The `stateSnapshot` includes each player's `deck` array so the client can initialize its hand from it.
- Integration test: ready is rejected with an invalid deck (too small).
- Integration test: a valid selected deck is used to populate the player's draw deck when the run starts (verifiable via `stateUpdate` payload).

## Technical Specs
- **File**: `game/server/index.js`
  - Modify `socket.on('playerReady', ...)`:
    - Before setting `player.ready = true`, call `validateDeck(player.selectedDeck, player.ownedCards)`.
    - If invalid: `player.ready = false`, `socket.emit('deckError', { reason: result.reason })`, `broadcastLobbyUpdate()`, return.
    - If valid: proceed as before.
  - Modify the `init` emit to include `selectedDeck` and `ownedCards`:
    - `socket.emit('init', { id: socket.id, state: gameState, layoutSeed: gameState.layoutSeed, layout: gameState.layout, selectedDeck: player.selectedDeck, ownedCards: player.ownedCards })`
  - Implement `createDrawDeckFromSelectedDeck(player)`:
    - Take `player.selectedDeck`, shuffle it (Fisher-Yates or similar), assign to `player.deck`.
    - Return the deck array.
  - Modify `checkAllReady()` (or the transition to `playing`):
    - After setting `gamePhase = 'playing'`, call `createDrawDeckFromSelectedDeck(player)` for each player.
    - The existing `initHand()` on the client side will need the server deck — the `stateSnapshot` already includes `player.deck`.
  - Export `createDrawDeckFromSelectedDeck` in `module.exports`.
- **File**: `game/server/test/server.test.js`
  - Unit test: `createDrawDeckFromSelectedDeck` produces a deck of same length as `selectedDeck`.
- **File**: `game/server/test/integration.test.js`
  - Test: player with deck smaller than `DECK_MIN_SIZE` tries to ready; server rejects, `player.ready` stays false.
  - Test: after all players ready with valid decks, `stateUpdate` contains each player's `deck` array matching their `selectedDeck` cards.

## Verification: code
