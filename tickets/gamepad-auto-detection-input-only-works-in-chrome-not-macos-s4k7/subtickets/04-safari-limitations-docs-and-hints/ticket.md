# Document Safari gamepad limitations and surface player hints

## Description

Document irreducible Safari Gamepad API quirks (gesture requirement, possible missing `gamepadconnected`, secure-context need) and ensure players see a clear activation hint in the settings UI—and anywhere else the game reports "no controller detected."

## Acceptance Criteria

- `game/docs/controls.md` has a **Gamepad / Safari** subsection explaining: pads may not appear until the player clicks/taps the page and presses a controller button; `gamepadconnected` may not fire on connect; HTTPS/localhost secure context is required; manual verification on macOS Safari is recommended.
- The settings-panel `#gamepad-activation-hint` text mentions Safari explicitly when `isSafariBrowser()` (or equivalent UA/sniff helper) returns true.
- When no pad is connected and access is not yet primed, the hint tells the player to interact with the page first, then press any controller button or move a stick.
- `formatGamepadDeviceInfo(null)` / `describeGamepadConnection(null)` messaging in `game/client/gamepad-detect.js` stays consistent with the new docs (update copy if needed).
- No new markdown files beyond editing `controls.md`.

## Technical Specs

- **File:** `game/docs/controls.md` — add Safari gamepad subsection after existing control bindings.
- **File:** `game/client/gamepad-detect.js` — add `isSafariBrowser()` helper (check `navigator.userAgent` for Safari excluding Chrome/Android); optionally export `getGamepadActivationHint({ primed, connected })` for shared hint copy.
- **File:** `game/client/controller-calibration.js` — use shared hint helper in `updateStatusDisplay()` for `#gamepad-activation-hint` visibility and text (Safari-specific sentence when applicable).
- **File:** `game/client/index.html` — update default `#gamepad-activation-hint` copy only if the static fallback should match the dynamic helper.
- **File:** `game/client/test/gamepad-detect.test.js` — test `isSafariBrowser()` with mocked UA strings and test hint text includes Safari guidance when UA is Safari.

## Verification: code
