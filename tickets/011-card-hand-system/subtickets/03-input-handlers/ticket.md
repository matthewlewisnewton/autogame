# Card Input Handlers (Keys 1-4 + Click)

Add keyboard and click handlers so pressing keys 1–4 or clicking a card slot triggers a "use card" action on the corresponding hand slot.

## Acceptance Criteria
- Pressing keys `1`, `2`, `3`, or `4` triggers the use of the card in hand slot 0–3 respectively
- Clicking a `.card-slot` element triggers the use of the card in that slot
- Using a card emits a Socket.IO `useCard` event: `socket.emit('useCard', { slotIndex, cardId })`
- Using a slot that is empty (no card) is a no-op
- The existing WASD key handlers continue to work without conflict

## Technical Specs
- **Files**: `game/client/main.js`
- Add keydown listener for keys `'1'` through `'4'`, mapping to slot indices 0–3
- Call a shared `useCard(slotIndex)` function from both keyboard and click paths
- `useCard(slotIndex)` reads the card from `hand[slotIndex]`; if `null`/`undefined`, returns early
- Emit `socket.emit('useCard', { slotIndex, cardId: hand[slotIndex].id })`
- Attach click listeners to each `.card-slot` in `renderHand()` (or once after DOM ready, reading `data-slot-index`)
- Do NOT block WASD keys — check `e.key` against `'1'`–`'4'` explicitly rather than intercepting all keydowns

## Verification: code
