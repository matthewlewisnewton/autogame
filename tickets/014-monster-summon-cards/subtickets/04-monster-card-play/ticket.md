# Client: Monster Card Play Handling

The client must handle the `monster` card type in the card play flow. Monster cards are single-use (like summons) — the card is consumed optimistically on `useCard` and confirmed on `cardUsed`. A `monsterCardIds` set is exported from `cards.js` for O(1) type checks.

## Acceptance Criteria
- `cards.js` exports a `monsterCardIds` Set containing the ids of all monster-type cards
- In `main.js`, the `useCard()` function treats monster cards as single-use: on click/keypress, the card is consumed (slot set to `null`, a replacement drawn from deck, hand re-rendered)
- The `cardUsed` socket handler in `main.js` handles monster card confirmations (no special visual effect needed beyond the card consumption — the minion appears via the rendering sub-ticket)
- Monster cards display with the existing purple styling (`#a78bfa`) from `CARD_TYPE_STYLE.monster`

## Technical Specs
- **File**: `game/client/cards.js`
  - Add `export const monsterCardIds = new Set();`
  - In the existing loop that populates `weaponCardIds` and `summonCardIds`, add: `if (def.type === 'monster') monsterCardIds.add(def.id);`
- **File**: `game/client/main.js`
  - Import `monsterCardIds` from `./cards.js`
  - In `useCard(slotIndex)`, add a branch for monster cards (after the `socket.emit('useCard', ...)` line, before the summon check):
    ```javascript
    // After socket.emit('useCard', ...):

    if (monsterCardIds.has(card.id)) {
      // Single-use: consume and draw replacement (optimistic, no server validation needed)
      hand[slotIndex] = null;
      const newCard = drawCard();
      if (newCard) hand[slotIndex] = newCard;
      renderHand();
      if (slotCooldowns[slotIndex]) return;
      slotCooldowns[slotIndex] = true;
      playActivationEffect(slotIndex);
      return;
    }
    ```
  - Note: unlike summons, monster cards do NOT wait for server confirmation before consuming — they are consumed optimistically (like weapons) since there is no resource cost to validate
  - In the `cardUsed` socket handler, no additional visual effect is needed for monster cards (the minion rendering is handled by sub-ticket 03)

## Verification: code
