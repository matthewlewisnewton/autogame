# Fix Charge Decrement Order — Prevent Server/Client Desync

Move the `remainingCharges` decrement and exhaust/redraw logic so it executes on every `useCard` call, regardless of whether the slot is in cooldown. Currently the cooldown early-return (`if (slotCooldowns[slotIndex]) return`) sits before the decrement, so a press during cooldown emits `useCard` to the server but skips the client-side charge decrement — causing the server to process more uses than the client counts.

## Acceptance Criteria
- Calling `useCard(slotIndex)` during a slot's cooldown still decrements `remainingCharges` and runs the exhaust/redraw path
- The `useCard` Socket.IO emit fires on every call (including during cooldown) — this behavior is preserved
- Only the visual flash animation (`.activating` class) is gated by the cooldown guard; charge logic is NOT gated
- After a cooldown-window press that exhausts a card, the slot is replaced by the next deck card (or goes empty if deck is exhausted)

## Technical Specs
- **File**: `game/client/main.js` — `useCard(slotIndex)` function
- Reorder the function body so the charge decrement + exhaust/redraw block runs **before** the `if (slotCooldowns[slotIndex]) return;` early-return
- Keep the flash animation (`playActivationEffect`) and the `slotCooldowns[slotIndex] = true` assignment gated by the cooldown check
- The resulting flow should be: (1) emit `useCard`, (2) decrement charges + exhaust/redraw + `renderHand()`, (3) if not in cooldown, set cooldown flag and play flash

## Verification: code
