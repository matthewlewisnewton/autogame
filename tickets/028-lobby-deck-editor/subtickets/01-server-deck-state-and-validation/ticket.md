# Server Deck State and Validation

Add a `selectedDeck` field to each player's server state and implement deck validation helpers. New players start with a default selected deck equivalent to the unique cards from the starting deck.

## Acceptance Criteria
- Each player object has a `selectedDeck` array (list of card id strings).
- New players are initialized with a default selected deck containing one copy of each unique card id from `STARTING_DECK_IDS` (iron_sword, flame_blade, battle_familiar, dungeon_drake).
- Constants `DECK_MIN_SIZE` (4) and `DECK_MAX_SIZE` (12) are exported from `game/server/index.js`.
- A `validateDeck(deck, ownedCards)` function exists and returns `{ valid: true }` or `{ valid: false, reason: '...' }`.
- Validation checks:
  - every card id in the deck exists in `CARD_DEFS`
  - deck length is between `DECK_MIN_SIZE` and `DECK_MAX_SIZE` (inclusive)
  - no card id appears more times in the deck than the player owns in `ownedCards`
- `canAddCardToDeck(cardId, deck, ownedCards)` returns a boolean for whether adding one copy of `cardId` would keep the deck valid.
- Unit tests cover: valid deck, unknown card id, deck too small, deck too large, too many copies of a card.

## Technical Specs
- **File**: `game/server/index.js`
  - Add constants `DECK_MIN_SIZE = 4`, `DECK_MAX_SIZE = 12` near `STARTING_DECK_IDS`.
  - Add `selectedDeck: []` to the player object created in the `connection` handler; initialize from unique ids of `STARTING_DECK_IDS`.
  - Implement `validateDeck(deck, ownedCards)` — iterates deck, checks each id against `CARD_DEFS`, checks length bounds, checks copy counts against `ownedCards`.
  - Implement `canAddCardToDeck(cardId, deck, ownedCards)` — checks `CARD_DEFS[cardId]`, current copy count in deck vs `ownedCards`, and `deck.length < DECK_MAX_SIZE`.
  - Export both functions in the `module.exports` block.
- **File**: `game/server/test/server.test.js`
  - Add unit tests for `validateDeck()` covering: valid deck, unknown card, too few cards, too many cards, too many copies.
  - Add unit tests for `canAddCardToDeck()` covering: valid add, unknown card, already at max copies, deck already at max size.

## Verification: code
