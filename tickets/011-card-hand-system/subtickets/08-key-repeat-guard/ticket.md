# Add Key Repeat Guard to Card Input Handler

The card keydown listener has no `e.repeat` check, so holding keys 1–4 fires `useCard()` continuously. Combined with the charge-decrement fix (sub-ticket 06), this floods the server with `useCard` emits and rapidly drains charges. Add a repeat guard to only accept the initial keydown press.

## Acceptance Criteria
- Holding a card key (1–4) down continuously does NOT trigger repeated `useCard()` calls
- Re-pressing the key (release then press again) fires `useCard()` once
- The guard only affects keyboard input; click-triggered `useCard()` is unaffected
- Existing WASD movement keydown/keyup handlers are not affected

## Technical Specs
- **File**: `game/client/main.js` — card keydown listener (the `window.addEventListener('keydown', ...)` that maps keys `'1'`–`'4'`)
- Add `if (e.repeat) return;` as the first line inside the `if (e.key in slotMap)` block, before calling `useCard()`
- Do not modify the WASD keydown/keyup listeners added in `initScene()`

## Verification: code
