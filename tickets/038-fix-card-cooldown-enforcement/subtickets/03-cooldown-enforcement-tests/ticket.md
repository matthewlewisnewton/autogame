# Add Tests for Cooldown Enforcement

Add client-side tests that reproduce the original cooldown bug (emit + mutation during cooldown) and verify the fix blocks all three mutation paths: socket emit, weapon charge drain, and monster card consumption.

## Acceptance Criteria

- A test verifies that calling `useCard()` on a cooling-down slot does **not** emit a `useCard` socket event.
- A test verifies that a cooling-down weapon slot does **not** lose additional `remainingCharges`.
- A test verifies that a cooling-down monster slot is **not** consumed or redrawn.
- A test verifies that `canUseSlot()` returns `false` when `slotCooldowns[slotIndex]` is `true`.
- Tests use `resetHandState()` to clear state between cases.
- `npm test -- --coverage.enabled=false` passes with all new tests green.

## Technical Specs

- **File to modify:** `game/client/test/main.test.js`
- Set up hand state via `hand.js` exports (`hand`, `slotCooldowns`, `resetHandState`), populate a slot with a weapon/monster card, set `slotCooldowns[i] = true`, then trigger the card use path.
- For the emit test: mock the socket (via `window.__setSocketForTest` if available, or the existing socket mock from `setup.js`) and assert the emit array is empty.
- For the charge test: assert `hand[i].remainingCharges` is unchanged after the call.
- For the monster test: assert `hand[i]` still references the same card object (not replaced by a redraw).
- If `useCard` is not directly exposed for testing, expose it as `window.__useCardForTest` (following the pattern of `window.__setScene`, `window.__setDeckState`).

## Verification: code
