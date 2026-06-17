# Map 8BitDo 64 Z button to lock-on input

Wire the physical Z trigger on the `8bitdo-64` gamepad profile to the lock-on action so a press edge calls `onLockOn` through the normal input pipeline. The profile must use browser button index 8 (SDL `lefttrigger:b8`) with the low analog threshold used for other 8BitDo triggers, and must not collide with C-button bindings.

## Acceptance Criteria

- `EIGHTBITDO_64_PROFILE.lockOnButton` is `8` (`EIGHTBITDO_64_LOCK_ON_BUTTON`).
- `isProfileLockOnPressed(pad, EIGHTBITDO_64_PROFILE)` returns `true` when button 8 is pressed or has a low analog value (≥ `EIGHTBITDO_64_C_BUTTON_THRESHOLD`), and `false` when button 8 is idle.
- Pressing Z (button 8) does not activate C↓ or any hand-slot `cButton` binding.
- With settings profile `8bitdo-64` and a mocked 8BitDo pad, `pollGamepadButtons()` edge-fires `lockOn: true` once per press.
- With the same setup, `pollInput()` in `input.js` invokes the `onLockOn` callback exactly once on a Z press edge.
- Unit tests in `game/client/test/gamepad-profiles.test.js`, `game/client/test/gamepad.test.js`, and `game/client/test/input.test.js` cover the above.

## Technical Specs

- **`game/client/gamepad-profiles.js`**: Confirm `EIGHTBITDO_64_LOCK_ON_BUTTON = 8`, `EIGHTBITDO_64_PROFILE.lockOnButton`, and `isProfileLockOnPressed` use the 8BitDo low threshold for button 8. Ensure Z/R trigger indices stay out of `EIGHTBITDO_64_C_DISCRETE_BUTTONS` and `read8BitDo64CButtonState`.
- **`game/client/gamepad.js`**: `pollGamepadButtons()` must resolve the active profile via `getGamepadSnapshot()` and call `isProfileLockOnPressed(pad, profile)` (not the standard `LOCK_ON_GAMEPAD_BUTTON` directly).
- **`game/client/input.js`**: `pollInput()` already calls `pollGamepadButtons().lockOn` → `callbacks.onLockOn`; no remapping needed unless the poll path skips profile resolution.
- **Tests**: Extend or add cases in the three test files above using `mockGamepad` with id containing `8BitDo 64` and `patchSettings({ gamepad: { profile: '8bitdo-64' } })` where the full `pollInput` path is exercised.

## Verification: code
