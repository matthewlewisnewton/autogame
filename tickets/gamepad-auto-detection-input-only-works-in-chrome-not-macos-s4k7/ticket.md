# Gamepad auto-detection + input only works in Chrome, not macOS Safari

## Difficulty: medium

## Goal

Gamepad auto-detection and input work in Chrome but not macOS Safari. The client detects pads via navigator.getGamepads() + the 'gamepadconnected' event (game/client/gamepad.js:218, getPrimaryGamepad in gamepad-profiles.js:403). Safari's Gamepad API is quirkier than Chromium's: it typically does NOT surface a connected pad (or fire gamepadconnected) until the user presses a button after a real user gesture, and historically has had partial support. So polling at load finds nothing in Safari. IMPROVE detection for Safari: poll navigator.getGamepads() after a user gesture / on the first button press, don't rely solely on gamepadconnected firing at load, and handle Safari's secure-context/gesture requirements. If parts are an unavoidable Safari Gamepad API limitation, document it (and surface a hint to the player). Confirm whether this is purely detection or also input-mapping once detected. NOTE: hard to verify in CI (no Safari + no physical pad) — code-review the detection path + manual check on Safari.

## Acceptance Criteria

- On macOS Safari, a connected gamepad is detected after a user gesture/button press and drives input (movement/look/buttons) as in Chrome; detection no longer depends solely on a load-time gamepadconnected event; any irreducible Safari limitation is documented with a user-facing hint.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
