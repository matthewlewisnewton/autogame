# Card Slot Resource States

Make card slots visually indicate resource constraints (cooldown, insufficient Magic Stones, empty slot) so the player can tell at a glance why a card can't be played.

## Acceptance Criteria
- Card slots already have a `.cooldown` CSS class (dimmed state) — verify it still works.
- Card slots gain a `.no-ms` CSS class when the player attempts to play a summon card but lacks Magic Stones (triggered by `cardError` with "Not enough Magic Stones").
- Empty card slots (no card) show a distinct visual style — darker background or dashed border — different from slots with cards.
- The `.no-ms` class is automatically removed when Magic Stones regenerate above the summon's cost.
- CSS rules exist in `style.css` for `.card-slot.no-ms` and `.card-slot.empty`.

## Technical Specs
- **File:** `game/client/style.css`
  - Add `.card-slot.no-ms` — red border or red tint to indicate insufficient Magic Stones.
  - Add `.card-slot.empty` — darker background, dashed border, or reduced opacity to distinguish from filled slots.
- **File:** `game/client/main.js`
  - In `renderHand()`, when a slot has no card, add the `empty` class to the slot element.
  - In the `cardError` socket handler, when `data.reason` is "Not enough Magic Stones", find the slot that was just used and add `.no-ms` class.
  - In the `animate` loop (or on `stateUpdate`), check each summon card in hand: if `magicStones >= card.magicStoneCost`, remove `.no-ms` from that slot.
- **File:** `game/client/test/main.test.js`
  - Test that `renderHand` applies `.empty` class to empty slots.

## Verification: code
