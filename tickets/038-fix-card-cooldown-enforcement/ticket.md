# Fix Card Slot Cooldown Enforcement

> **Staleness note.** This bug ticket was written against commit
> `c8f0a9e` (2026-05-19). The codebase may have moved on since it was filed -
> before acting, re-check every file path and code reference below against the
> CURRENT code, and skip or revise any detail that is already resolved.

## Bug

`game/client/main.js` shows a cooldown state on card slots, but `useCard()` emits
`useCard` before checking `slotCooldowns[slotIndex]`:

```js
// (1) Emit useCard - fires on every call, including during cooldown
socket.emit('useCard', { slotIndex, cardId: card.id });
```

For weapon cards, the same function also decrements charges before the cooldown
guard. For monster cards, it consumes and redraws the card before checking the
cooldown guard. That makes the cooldown mostly visual: repeated clicks during
the 1.2 second dimmed state can send extra server events and consume extra local
charges/cards.

Keyboard repeat is guarded, but mouse clicks and direct calls are not. This is
especially confusing because `.card-slot.cooldown` visually tells the player the
slot is unavailable.

## Expected Behavior

When `slotCooldowns[slotIndex]` is true, the client should not:

- emit `useCard`
- decrement weapon charges
- consume or redraw monster cards
- start another activation effect

The cooldown should gate the local action at the top of `useCard()`.

## Implementation Notes

- Move the cooldown check before the socket emit and before any card mutation.
- Keep the existing empty-slot and slot-index guards first.
- For rejected summon cards, make sure the cooldown still clears after the
  existing timeout and the card remains in hand.
- Consider extracting the "can this slot be used now?" decision into a small
  pure helper if that makes testing simpler.
- Do not add server-owned hand state in this ticket unless the implementation
  stays small. A future anti-cheat/server-authoritative-card ticket can handle
  hostile clients.

## Test Snippet

Add a focused client test. If importing `main.js` directly is awkward, expose a
test-only hook under `window` or extract a pure helper from `useCard()`.

Example shape for `game/client/test/main.test.js`:

```js
it('does not emit or consume a card while its slot is cooling down', async () => {
  vi.resetModules();

  const handModule = await import('../hand.js');
  handModule.resetHandState();
  handModule.hand[0] = {
    id: 'iron_sword',
    name: 'Iron Sword',
    type: 'weapon',
    charges: 5,
    remainingCharges: 5
  };
  handModule.slotCooldowns[0] = true;

  const emitted = [];
  window.__setSocketForTest?.({
    emit: (event, payload) => emitted.push({ event, payload })
  });

  window.__useCardForTest(0);

  expect(emitted).toEqual([]);
  expect(handModule.hand[0].remainingCharges).toBe(5);
});
```

If the test uses the existing socket mock instead of `window.__setSocketForTest`,
assert the same behavior: no `useCard` event and no hand mutation while the slot
is cooling down.

## Acceptance Criteria

- A cooling-down slot cannot emit another `useCard` event from normal client
  input.
- A cooling-down weapon slot does not lose additional charges.
- A cooling-down monster slot is not consumed or redrawn.
- Existing summon rejection behavior still preserves the card when the server
  returns `Not enough Magic Stones`.
- Add or update a client test that reproduces the underlying cooldown bug and
  proves it is fixed.
- `npm test -- --coverage.enabled=false` passes.
