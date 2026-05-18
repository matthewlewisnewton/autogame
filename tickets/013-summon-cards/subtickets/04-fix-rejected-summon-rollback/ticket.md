# Fix: Rollback Summon Card on Server Rejection

When a player plays a Summon card without enough Magic Stones, the server correctly rejects the play (`cardError`), but the client has already consumed the card from the hand and drawn a replacement. A rejected Summon must leave the card in the player's hand.

## Acceptance Criteria
- Pressing the Summon key while having insufficient Magic Stones shows the "Not enough Magic Stones" toast **and leaves the Summon card in the hand slot** (charges unchanged, no replacement drawn)
- A successful Summon play still consumes the card (charges go to 0, card is removed, replacement drawn) exactly as before
- The activation flash / cooldown visual on the slot still fires on every `useCard` call (both accepted and rejected)
- Hand state after a rejected Summon is byte-identical to hand state before the press

## Technical Specs
- **`game/client/main.js`**:
  - In `useCard(slotIndex)`, guard summon-type cards from optimistic consumption:
    - Before decrementing `remainingCharges`, check `if (summonCardIds.has(card.id))` — if true, **skip** the charge decrement, exhaust/redraw, and `renderHand()` calls; only emit `useCard` and run the activation/cooldown effect
  - In the existing `cardUsed` socket handler, add logic for the local player's summon plays:
    - When `data.playerId === myId` AND `summonCardIds.has(data.cardId)`, find the slot holding that card id, set `hand[slotIndex] = null`, draw a replacement via `drawCard()`, and call `renderHand()`
  - In the existing `cardError` handler (`showCardErrorToast`), no card-state change is needed — the card was never removed, so the toast alone is sufficient feedback
  - Import `summonCardIds` from `./cards.js` (already imported at top of file)

## Verification: code
