# Client Deck Editor UI

Add a deck editor panel to the lobby overlay showing owned cards, the selected deck, deck size, and add/remove buttons. Wire socket communication for deck edits and display server errors.

## Acceptance Criteria
- The lobby HTML contains a deck editor section with:
  - An "Owned Cards" list showing each card name, icon, and count the player owns.
  - A "Selected Deck" list showing each card in the deck with a remove button per entry.
  - A deck size counter (e.g., "4/12").
  - An error message area that shows validation errors.
- The ready button is visually disabled (or shows an error) when the deck is invalid (too small).
- Clicking an "add" button on an owned card emits `deckAddCard` to the server.
- Clicking a "remove" button on a deck entry emits `deckRemoveCard` to the server.
- On receiving `deckUpdate`, the client re-renders the owned cards list, selected deck list, and deck size.
- On receiving `deckError`, the client displays the error message in the error area.
- The deck editor is visible only in the lobby (hidden during gameplay).
- Client test: the deck editor renders owned counts and selected deck size from mock data.

## Technical Specs
- **File**: `game/client/index.html`
  - Add deck editor HTML inside `#lobby`:
    - `<div id="deck-editor">` wrapper
    - `<div id="owned-cards-list">` for owned cards with add buttons
    - `<div id="selected-deck-list">` for deck entries with remove buttons
    - `<div id="deck-size-display">` for "4/12" counter
    - `<div id="deck-error" style="display:none;">` for error messages
- **File**: `game/client/style.css`
  - Add styles for `#deck-editor`, `#owned-cards-list`, `#selected-deck-list`, `#deck-size-display`, `#deck-error`.
  - Style add/remove buttons to match existing lobby styling.
  - Style the disabled ready button state.
- **File**: `game/client/main.js`
  - Add module-level variables: `let mySelectedDeck = []`, `let myOwnedCards = {}`.
  - On `init`: read `data.selectedDeck` and `data.ownedCards` into module vars; call `renderDeckEditor()`.
  - On `stateUpdate`: update `myOwnedCards` from `gameState.players[myId].ownedCards` if present.
  - Implement `renderDeckEditor()`:
    - Clear and repopulate `#owned-cards-list` from `myOwnedCards` using `CARD_DEFS` for names/icons.
    - Clear and repopulate `#selected-deck-list` from `mySelectedDeck`.
    - Update `#deck-size-display` text.
    - Check deck size against `DECK_MIN_SIZE` (imported or hardcoded as 4); disable ready button if too small.
    - Hide `#deck-error`.
  - Socket handler `socket.on('deckUpdate', (data) => { ... })`: update `mySelectedDeck`, `myOwnedCards`, call `renderDeckEditor()`.
  - Socket handler `socket.on('deckError', (data) => { ... })`: show error in `#deck-error`.
  - Wire add/remove button click handlers to emit `deckAddCard` / `deckRemoveCard`.
- **File**: `game/client/test/main.test.js`
  - Test: `renderDeckEditor()` populates owned card counts and deck size from mock data (mock DOM elements).

## Verification: code
