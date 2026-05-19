# Extract `canUseSlot()` Pure Helper

Extract the "can this slot be used now?" decision from `useCard()` into a small pure helper `canUseSlot(slotIndex)` in `game/client/hand.js`. The helper checks that the slot index is valid (0–3), the slot contains a card, and the slot is not currently in cooldown.

This makes the cooldown logic independently testable without needing to import or mock `main.js`'s DOM/Socket dependencies.

## Acceptance Criteria

- `canUseSlot(slotIndex)` exists in `game/client/hand.js` and is exported.
- Returns `false` for slot indices outside 0–3.
- Returns `false` when `hand[slotIndex]` is `null` or `undefined`.
- Returns `false` when `slotCooldowns[slotIndex]` is `true`.
- Returns `true` when the slot is in-range, has a card, and is not cooling down.
- The function is pure — it reads `hand` and `slotCooldowns` but never mutates them.

## Technical Specs

- **File to modify:** `game/client/hand.js`
- Add `export function canUseSlot(slotIndex)` that returns a boolean based on the three guards above.
- Keep the function small (≤10 lines) and self-contained.

## Verification: code
