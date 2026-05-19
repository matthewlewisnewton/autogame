# Gate Cooldown Check at Top of `useCard()`

Move the cooldown guard to the very top of `useCard()` in `game/client/main.js`, before the socket emit and before any card mutation (charge decrement, monster consume+redraw). Use the `canUseSlot()` helper from `hand.js` to perform the combined check.

Currently the bug allows repeated clicks during the 1.2s cooldown window to emit extra `useCard` events, drain weapon charges, and consume monster cards. This sub-ticket makes the cooldown a hard gate.

## Acceptance Criteria

- `useCard()` returns immediately (no-op) when `canUseSlot(slotIndex)` returns `false`.
- The cooldown guard is placed **before** `socket.emit('useCard', ...)`.
- The cooldown guard is placed **before** any weapon charge decrement (`card.remainingCharges -= 1`).
- The cooldown guard is placed **before** any monster card consumption (`hand[slotIndex] = null` + redraw).
- Summon card behavior is unchanged: the cooldown still gates the emit, and the card remains in hand when the server rejects with `Not enough Magic Stones`.
- Existing empty-slot guard (`if (!card) return`) is preserved.
- The existing activation effect and cooldown timer are only triggered when the slot passes the guard.

## Technical Specs

- **File to modify:** `game/client/main.js`
- Import `canUseSlot` from `./hand.js` (already imported alongside `hand`, `slotCooldowns`, `drawCard`).
- Replace the current empty-slot guard with a call to `canUseSlot(slotIndex)` at the top of `useCard()`, or add the `canUseSlot` check immediately after it.
- Remove the scattered `if (slotCooldowns[slotIndex]) return` checks that currently appear mid-function (after monster/weapon branches) — the single top-level guard replaces them all.
- Keep `lastUsedSlot = slotIndex` tracking after the guard (or before — either is fine as long as the emit is blocked).

## Verification: code
