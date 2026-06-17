# C-stick camera free-look when lock-on is inactive

On the `8bitdo-64` profile, horizontal C-stick input (axis 2) should orbit the camera while lock-on is off. While lock-on is active or the post-death camera release is playing, manual look input must be suppressed so the lock-on camera system owns yaw.

## Acceptance Criteria

- With profile `8bitdo-64` and `lookSource: 'cStick'`, `pollGamepadLook(delta)` returns a non-zero yaw delta when axis 2 is deflected horizontally and lock-on is inactive.
- `pollGamepadLook(delta)` returns `0` when `isLockOnActive()` or `isLockOnCameraReleasing()` is true, even if axis 2 is deflected.
- `read8BitDo64CStickHorizontal(pad)` reads only analog axis 2 (horizontal C-cluster); discrete C-button presses (buttons 2–5) return `0` so card bindings do not steer the camera.
- Digital C←/C→ via axis 2 still contribute to camera look when not locked on (axis-dominant horizontal deflection).
- Unit tests in `game/client/test/gamepad.test.js` and `game/client/test/gamepad-profiles.test.js` cover look active when unlocked and suppressed when locked.

## Technical Specs

- **`game/client/gamepad.js`**: `pollGamepadLook(delta)` — early return `0` when `isLockOnActive() || isLockOnCameraReleasing()`; when `profile.lookSource === 'cStick'`, delegate to `read8BitDo64CStickHorizontal(pad, deadzone)` and scale by `GAMEPAD_LOOK_SENSITIVITY * delta` (negated like the right-stick path).
- **`game/client/gamepad-profiles.js`**: `read8BitDo64CStickHorizontal` — keep axis-2-only analog look; do not fold discrete `cButton` state into camera yaw (card slots own those).
- **`game/client/lockOn.js`**: `isLockOnActive`, `isLockOnCameraReleasing` — used as guards; no changes unless tests need exported helpers to toggle state.
- **Tests**: Add `pollGamepadLook` cases with `installGamepadMock`, `patchSettings({ gamepad: { profile: '8bitdo-64' } })`, axis 2 deflection, and lock-on state toggled via `handleLockOnPress` / `clearAllLockOnState` from `lockOn.js`.

## Verification: code
