# Fix Starting Deck Card Counts in createPlayerProgress

`createPlayerProgress()` deduplicates `STARTING_DECK_IDS` with `new Set()` and assigns count 1 to each unique id. The starting deck requires iron_sword ×3, flame_blade ×2, battle_familiar ×2, dungeon_drake ×1. New players must own enough cards to build their starting deck.

## Acceptance Criteria
- `createPlayerProgress()` counts occurrences of each card id in `STARTING_DECK_IDS` instead of deduplicating.
- The resulting `ownedCards` is `{ iron_sword: 3, flame_blade: 2, battle_familiar: 2, dungeon_drake: 1 }`.
- A new player connecting to the server receives these correct counts in their `ownedCards`.
- All existing `createPlayerProgress()` unit tests are updated to assert the correct per-id counts (not all 1s).
- `npm test` reports 0 failures for `createPlayerProgress` tests.

## Technical Specs
- **File**: `game/server/index.js`
  - In `createPlayerProgress()`, replace the `new Set(STARTING_DECK_IDS)` loop with a frequency-count loop:
    ```javascript
    const ownedCards = {};
    for (const cardId of STARTING_DECK_IDS) {
      ownedCards[cardId] = (ownedCards[cardId] || 0) + 1;
    }
    ```
  - The comment above the function should be updated to say `ownedCards` is a frequency map from the starting deck (not "unique card id → count").
- **File**: `game/server/test/server.test.js`
  - Update the test 'populates ownedCards with the 4 unique starting deck card ids at count 1' to assert the correct frequency counts: `{ iron_sword: 3, flame_blade: 2, battle_familiar: 2, dungeon_drake: 1 }`.
  - Update the test 'each owned card has a count of 1' to verify that counts match the expected frequencies (not all 1).
  - The 'has exactly 4 owned card entries' test remains correct (4 unique ids).
  - The 'returns independent objects on each call' test should update its mutation check to use the correct initial value (3 for iron_sword).

## Verification: code
