# Unify movement through input.js

Make `input.js` the sole owner of keyboard movement state and the sole gamepad stick reader. Remove the duplicate `keys` map, WASD listeners, and `getKeyboardMovement()` from `renderer.js`, and route renderer movement through `getMovementDirection()`. Replace `readMoveStick()` with `pollGamepadMovement()` from `gamepad.js`. Add an `isTypingTarget` guard so movement and action keys do not fire while the user is typing in form fields.

## Acceptance Criteria

- `renderer.js` has no `keys` object, no WASD `keydown`/`keyup` listeners, and no `getKeyboardMovement()` function.
- `getMovementInput()` in `renderer.js` derives movement exclusively from `getMovementDirection()` in `input.js` (with a small adapter that preserves the existing `{ x, z }` sign convention used by `cameraRelativeDirection`).
- `input.js` no longer defines or calls `readMoveStick()`; `getMovementDirection()` uses `pollGamepadMovement()` from `gamepad.js` (respecting deadzone and `moveStick` from settings) for analog stick input, still merging keyboard when the stick is idle.
- `isPlayerMoving()` and `resetMovementKeys()` in `renderer.js` no longer reference the deleted `keys` map; reset calls `resetInputState()` from `input.js` plus `resetGamepadState()` from `gamepad.js`.
- `onKeyDown` and `onKeyUp` in `input.js` return early when `isTypingTarget(e.target)` is true (same predicate as the current renderer helper: `HTMLInputElement`, `HTMLTextAreaElement`, or `contentEditable`).
- `pnpm test:quick` passes; existing `input.test.js` movement tests still pass after the gamepad stick change.

## Technical Specs

- **`game/client/renderer.js`**
  - Delete `const keys`, `getKeyboardMovement()`, and the `inputListenersAdded` keydown/keyup listener block (including the hardcoded `z` / lock-on branch — keyboard lock-on is restored via `input.js` in sub-ticket 02). Retain blur/visibility listeners that call `resetMovementKeys()`.
  - Import `getMovementDirection`, `resetInputState` from `./input.js`.
  - Rewrite `getMovementInput()` to call `getMovementDirection()` and map `{ dx, dz, mag }` → `{ x, z } | null`, preserving current forward/back sign (renderer today treats `w` as `+z`; adapt accordingly).
  - Update `isPlayerMoving()` to use `getMovementDirection().mag > 0` or equivalent.
  - Update `resetMovementKeys()` to call `resetInputState()` + `resetGamepadState()`.
  - Remove local `isTypingTarget()` if nothing else references it after listener removal.
- **`game/client/input.js`**
  - Import `pollGamepadMovement` from `./gamepad.js` and `getGamepadConfig` (already imported) for deadzone/moveStick.
  - Remove `readMoveStick()`; in `getMovementDirection()`, when a gamepad is connected, call `pollGamepadMovement(deadzone, moveStick)` and, if non-null, return `{ dx: stick.x, dz: stick.z, mag: hypot(...) }`.
  - Add `isTypingTarget(target)` helper and guard both `onKeyDown` and `onKeyUp`.
- **`game/client/test/input.test.js`**
  - Update any tests that mock stick axes directly through `readMoveStick` internals; assert behavior via `getMovementDirection()` with mocked gamepad if needed.

## Verification: code
