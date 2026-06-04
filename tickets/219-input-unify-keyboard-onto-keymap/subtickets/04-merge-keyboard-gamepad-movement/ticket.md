# Merge keyboard and gamepad movement in getMovementDirection

`getMovementDirection()` currently early-returns the gamepad stick vector whenever `pollGamepadMovement()` is non-null, discarding active WASD `keyState`. Restore the pre-unification behavior: combine keyboard and gamepad movement vectors with sign-correct normalization and clamp combined magnitude to 1.

## Acceptance Criteria

- When both keyboard movement keys and a gamepad stick/D-pad vector are active, `getMovementDirection()` returns a merged direction whose components reflect both inputs (not gamepad-only).
- Combined magnitude is clamped to at most 1 (same semantics as `mergeMovementVectors()` in `gamepad.js`).
- Keyboard-only and gamepad-only movement still behave as today when the other source is idle.
- `pnpm test:quick` passes, including a new regression test that holds `w` while a mocked stick is deflected and asserts the merged direction differs from gamepad-only.

## Technical Specs

- **`game/client/input.js`**
  - Import `mergeMovementVectors` from `./gamepad.js`.
  - In `getMovementDirection()`, build a keyboard vector `{ x: dirX, z: dirZ }` from `keyState` (normalize when `mag > 0` before merge, or pass raw axes consistent with how `mergeMovementVectors` expects partial vectors).
  - Call `pollGamepadMovement(deadzone, moveStick)` when a gamepad is connected.
  - Use `mergeMovementVectors(keyboardVec, stickVec)` (or equivalent) instead of returning stick alone; map merged `{ x, z }` back to `{ dx, dz, mag }` with the existing `dz: -stick.z` sign convention for gamepad axes.
  - Remove the early `return` that bypasses keyboard state when stick is present.
- **`game/client/test/input.test.js`**
  - Add test: `initInput({})`, dispatch `keydown` for `w`, mock gamepad with a non-idle left stick (e.g. `axes: [0.9, 0, 0, 0]`), call `getMovementDirection()`, assert `mag > 0` and that `dx`/`dz` reflect both forward keyboard and stick contribution (e.g. merged `dx` non-zero when stick pushes east and `w` is held).

## Verification: code
