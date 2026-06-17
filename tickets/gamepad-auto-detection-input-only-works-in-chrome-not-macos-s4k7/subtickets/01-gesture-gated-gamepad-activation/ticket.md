# Gesture-gated gamepad activation polling

## Description

Safari does not populate `navigator.getGamepads()` or fire `gamepadconnected` until the user has interacted with the page and pressed a controller button. Add a small activation module that primes gamepad access on user gestures and polls for newly connected pads each frame, emitting connect/disconnect callbacks independent of the browser `gamepadconnected` event.

## Acceptance Criteria

- A new `initGamepadActivation()` registers one-time listeners on `pointerdown`, `keydown`, and `touchstart` that mark gamepad access as primed and immediately call `navigator.getGamepads()`.
- After priming, a lightweight rAF poll compares the current `getConnectedGamepads()` result to the previous snapshot and invokes registered callbacks when a pad appears or disappears (even if `gamepadconnected` never fired).
- `onGamepadActivationChange(callback)` (or equivalent) allows subscribers to receive `{ connected: Gamepad | null, pads: Gamepad[] }` on transitions.
- `isGamepadAccessPrimed()` (or equivalent) exposes whether a user gesture has occurred.
- Unit tests in `game/client/test/gamepad-activation.test.js` simulate Safari: `getGamepads()` returns empty until `primeGamepadAccess()` is called, then returns a mock pad and the connect callback fires.

## Technical Specs

- **New file:** `game/client/gamepad-activation.js`
  - Export `initGamepadActivation`, `onGamepadActivationChange`, `isGamepadAccessPrimed`, and a `primeGamepadAccess()` helper callable from gesture handlers.
  - Reuse `getConnectedGamepads()` from `game/client/gamepad-detect.js` for polling.
  - Track previous pad indices/ids to detect connect vs disconnect without duplicating `getPrimaryGamepad` logic.
  - Start the rAF poll loop lazily on first `initGamepadActivation()` call; stop is not required (matches existing gamepad listener pattern).
- **New file:** `game/client/test/gamepad-activation.test.js`
  - Use `gamepad-mock.js` to inject delayed pad availability.
  - Assert no callback before gesture; assert callback after `primeGamepadAccess()` + poll tick.
- **Do not wire** into `main.js` or `renderer.js` in this sub-ticket — module + tests only.

## Verification: code
