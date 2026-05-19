# Set default selected deck to full 8-card starting deck

New players currently get a default `selectedDeck` of 4 unique card IDs (`[...new Set(STARTING_DECK_IDS)]`). This deals all 4 into the opening hand with nothing left in the draw deck, so exhausted weapon slots never refill mid-run. Change the default to the full 8-card `STARTING_DECK_IDS` so players have a draw-deck reserve.

## Acceptance Criteria
- The default `selectedDeck` for new players is set to `STARTING_DECK_IDS` (8 cards, not 4 unique).
- The default deck length is ≤ `DECK_MAX_SIZE` (12).
- The default deck cards are valid against the player's `ownedCards` counts (each card count in deck ≤ owned count).
- A comment near `defaultDeck` documents the intent (full starting deck for draw-deck reserve).
- `npx vitest run` reports the full suite green.

## Technical Specs
- **File**: `game/server/index.js` — line ~923, change `const defaultDeck = [...new Set(STARTING_DECK_IDS)]` to `const defaultDeck = [...STARTING_DECK_IDS]` (or equivalent that produces the full 8-card array).
- **File**: `game/server/index.js` — update the comment on line ~922 to explain the choice (full starting deck provides draw-deck reserve).
- **File**: `game/server/test/integration.test.js` — any test asserting `selectedDeck.length === 4` on a fresh player must be updated to `=== 8`.

## Verification: code
