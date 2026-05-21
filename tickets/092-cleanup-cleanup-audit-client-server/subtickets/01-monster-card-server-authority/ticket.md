# Fix monster card optimistic client redraw

Monster cards (`monsterCardIds`) in `useCard()` still null the hand slot and call `drawCard()` optimistically (~lines 403–408 in `game/client/main.js`). Summons were already fixed to wait for server authority via `stateUpdate` reconciliation — apply the same pattern to monster cards to eliminate transient hand drift.

## Acceptance Criteria

- Monster card `useCard` path does **not** call `drawCard()` or set `hand[slotIndex] = null` on the client side.
- Monster card `useCard` path sets `slotCooldowns[slotIndex] = true` and calls `playActivationEffect(slotIndex)` (identical to the summon path).
- Hand slot updates for monster plays come from `stateUpdate` reconciliation only (the existing reconciliation loop already handles slot replacement).
- No other changes to summon card handling, weapon card handling, or hand reconciliation logic.

## Technical Specs

- **File:** `game/client/main.js` — `useCard()` function (~lines 403–408)
- Remove the `if (monsterCardIds.has(card.id))` block that does optimistic `hand[slotIndex] = null`, `drawCard()`, and `renderHand()`.
- Replace with the same behavior as summons: set `slotCooldowns[slotIndex] = true`, call `playActivationEffect(slotIndex)`, and `return`.
- No other changes. Do not touch `game/server/index.js`, `game/client/hand.js`, or any test files.

## Verification: code
