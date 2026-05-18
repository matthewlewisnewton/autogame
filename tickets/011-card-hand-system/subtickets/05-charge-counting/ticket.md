# Multi-use Charge Counting & Auto-draw

Multi-use cards display their remaining charge count on the HUD slot. Each use decrements the charge; when it reaches 0, the card is discarded and replaced by the next card from the deck.

## Acceptance Criteria
- Each `.card-slot` displays the card's remaining charge count (e.g., as a small number overlay or suffix)
- Using a card decrements its `remainingCharges`; the HUD updates to show the new count
- When `remainingCharges` reaches 0, the card is removed from the slot and the next card from the deck is drawn into that slot
- The newly drawn card starts with `remainingCharges` equal to its `charges` definition value
- If the deck is exhausted when a draw is needed, the slot becomes empty (shows "—" or blank)
- The charge count is visible and updates in real time after each use

## Technical Specs
- **Files**: `game/client/main.js`, `game/client/style.css`
- In `useCard(slotIndex)`, after emitting, decrement `hand[slotIndex].remainingCharges`
- If `remainingCharges <= 0`: remove the card from hand, draw from `deck` (pop or shift), set new card's `remainingCharges = CARD_DEFS[newId].charges`; if deck is empty, set `hand[slotIndex] = null`
- Call `renderHand()` to refresh the slot display after decrement or draw
- `renderHand()` renders charge count as a small badge or text on the slot (e.g., `<span class="card-charges">3</span>`)
- For single-use cards (`charges: 1`), the card is discarded after one use and replaced immediately
- Add CSS for `.card-charges`: small font, positioned absolute bottom-right or inline below the name

## Verification: code
