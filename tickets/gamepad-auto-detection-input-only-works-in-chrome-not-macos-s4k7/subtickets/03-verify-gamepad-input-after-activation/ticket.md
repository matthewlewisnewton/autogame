# Verify gamepad input path after delayed activation

## Description

Confirm the top-level ticket's input concern: once a pad is exposed by Safari-style delayed detection, movement, camera look, and button bindings must work through the existing per-frame snapshot path. Add focused regression tests; apply only minimal mapping fixes if Safari exposes a pad but axis/button reads are wrong.

## Acceptance Criteria

- After simulated gesture priming and delayed mock pad insertion, `pollGamepadMovement()` returns a non-null vector when the left stick is deflected.
- After the same setup, `pollGamepadLook()` returns a non-zero yaw delta when the right stick is deflected (standard profile).
- After the same setup, `pollInput()` invokes `onUseSlot` / `onLockOn` handlers for default gamepad button presses (standard profile).
- `pollGamepadSnapshot()` is invalidated when activation reports a new connect so the first gameplay frame reads the fresh pad.
- If investigation shows input already works once detected (expected), no mapping changes in `gamepad-profiles.js`; if a Safari-specific mapping gap is found and fixable in tests, document the change in a code comment near the fix.

## Technical Specs

- **File:** `game/client/test/gamepad.test.js` — add describe block for delayed-activation input: install mock, prime activation, insert pad with stick/button values, call `pollGamepadSnapshot()` then assert movement/look readers.
- **File:** `game/client/test/input.test.js` — add test chaining activation → `pollInput()` → slot/lock-on callbacks.
- **File:** `game/client/gamepad.js` — only if needed: ensure `invalidateGamepadSnapshot()` is called on activation connect (may already land in sub-ticket 02).
- **File:** `game/client/gamepad-profiles.js` — change only if tests prove Safari mapping mismatch; keep diff minimal.

## Verification: code
