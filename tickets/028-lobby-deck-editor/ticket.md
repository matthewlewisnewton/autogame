# Lobby Deck Editor

Add a small lobby deck editor that uses the server-owned session inventory from `026-card-rewards-deckbuilding`. Players should be able to choose a valid deck before readying up.

## Dependencies

This ticket assumes `026-card-rewards-deckbuilding` has server-owned `ownedCards` and reward state.

## Goal

The lobby should let a player inspect owned cards, build a deck, and start the next run with that server-approved deck.

## Acceptance Criteria
- The server stores each player's selected deck separately from owned cards.
- New players start with a valid selected deck equivalent to the current starting deck.
- The server exposes the local player's deck state to the client in `init` and/or a dedicated event.
- The lobby UI shows:
  - owned card list with counts
  - selected deck list
  - current deck size
  - validation errors, if any
- Players can add a card from owned cards to the selected deck.
- Players can remove a card from the selected deck.
- The client sends deck edit intents to the server, such as `deckAddCard` and `deckRemoveCard`.
- The server validates every deck edit.
- The server rejects:
  - unknown card ids
  - adding more copies than owned
  - deck sizes above the maximum
  - removing cards below the minimum only when readying, not necessarily while editing
- The ready button is blocked if the selected deck is invalid.
- The client shows a clear error if ready is blocked by an invalid deck.
- Starting a run uses the server-approved selected deck to create the player's draw deck and initial hand.
- Client-side card drawing no longer relies on only `createStartingDeck()` for live play.
- Existing key input, cooldowns, summon rejection rollback, and monster-card behavior still work with server-provided decks.

## Deck Rules
- Minimum deck size: 4 cards.
- Maximum deck size: 12 cards for now.
- A player cannot include more copies of a card than they own.
- Card ids must exist in the known card definitions.
- These constants should be named so later tickets can tune them.

## Implementation Notes
- Prefer small helpers:
  - `validateDeck(deck, ownedCards)`
  - `canAddCardToDeck(cardId, deck, ownedCards)`
  - `createDrawDeckFromSelectedDeck(player)`
  - `dealInitialHand(player)`
- Keep deck editing in the lobby only. Do not allow deck edits while `gamePhase === 'playing'`.
- Keep the UI simple: buttons or clickable rows are enough.
- Avoid drag-and-drop for this ticket.
- Do not add persistence or account binding.

## Files
- `game/server/index.js`
- `game/client/cards.js`
- `game/client/hand.js`
- `game/client/main.js`
- `game/client/index.html`
- `game/client/style.css`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`
- `game/client/test/main.test.js`

## Tests
- Unit test `validateDeck()` for valid deck, unknown card, too few cards, too many cards, and too many copies.
- Integration test that deck edit events update only the sending player's deck.
- Integration test that ready is rejected with an invalid deck.
- Integration test that a valid selected deck is used to deal the initial hand when the run starts.
- Client test that the lobby deck editor renders owned counts and selected deck size.

## Verification: visual
