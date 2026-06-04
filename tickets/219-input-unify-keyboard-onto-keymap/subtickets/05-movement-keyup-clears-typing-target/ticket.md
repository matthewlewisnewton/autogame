# Movement keyup clears keyState even from typing targets

`onKeyUp` applies `isTypingTarget` to all keys, so releasing a movement key while focus is in an input or contenteditable leaves `keyState` stuck and the player keeps moving. Keep the typing-target guard on `onKeyDown` for movement and actions, but always process movement keyup so held WASD clears correctly.

## Acceptance Criteria

- `onKeyDown` still returns early when `isTypingTarget(e.target)` is true (movement keys do not start while typing; action keys do not fire).
- `onKeyUp` clears `keyState` for movement actions (`moveUp`, `moveDown`, `moveLeft`, `moveRight`) even when `e.target` is a typing target.
- `onKeyUp` still ignores non-movement keys from typing targets (e.g. releasing `e` in a text field does not need to dispatch actions — no change required beyond not falsely clearing unrelated state).
- After holding `w`, focusing an `<input>`, and releasing `w` with the input focused, `getMovementDirection().mag` is 0.
- `pnpm test:quick` passes, including a regression test for the focus-then-release sequence.

## Technical Specs

- **`game/client/input.js`**
  - Refactor `onKeyUp`: remove the blanket `if (isTypingTarget(e.target)) return` at the top, or restrict it so movement key handling runs unconditionally.
  - Suggested shape: parse `e.key`, match `DEFAULT_KEYBOARD` movement actions, set `keyState[action] = false` without a typing guard; optionally keep `isTypingTarget` guard only for any future non-movement keyup side effects (currently none).
  - Do not change `onKeyDown` typing guard behavior.
- **`game/client/test/input.test.js`**
  - Add test: `initInput({})`, `keydown` `w` (verify `mag > 0`), create a detached `HTMLInputElement`, append to `document.body`, call `input.focus()`, dispatch `keyup` for `w` with `{ key: 'w', target: input }` (use `initKeyboardEvent` or construct `KeyboardEvent` and define `target`), assert `getMovementDirection().mag === 0`, clean up DOM.

## Verification: code
