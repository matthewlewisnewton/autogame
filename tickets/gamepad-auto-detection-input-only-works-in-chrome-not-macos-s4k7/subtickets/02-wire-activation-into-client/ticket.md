# Wire gamepad activation into client lifecycle and UI

## Description

Integrate the gesture-gated activation module from sub-ticket 01 so the running game detects Safari-connected pads after the player's first interaction, and treat poll-detected connects the same as native `gamepadconnected` events for snapshot invalidation and UI refresh.

## Acceptance Criteria

- `initGamepadActivation()` is called once during client startup (from `game/client/main.js` or `game/client/renderer.js` alongside existing `initGamepadListeners()`).
- `initGamepadListeners()` in `game/client/gamepad.js` subscribes to activation connect/disconnect callbacks and calls `resetGamepadState()` / `invalidateGamepadSnapshot()` on transitions (in addition to existing `gamepadconnected` / `gamepaddisconnected` window listeners).
- `game/client/main.js` refreshes gamepad-dependent UI (hand slot hints via `renderHand()`, attack hint text, key-item HUD) when activation polling detects a new pad, not only when `window` fires `gamepadconnected`.
- `game/client/controller-calibration.js` `updateStatusDisplay()` reflects a poll-detected pad even when the settings overlay is closed and reopened later (status reads live `getConnectedGamepads()` via activation, not stale event-only state).
- Existing `gamepad.test.js` and `input.test.js` suites still pass; add at least one integration test proving `getHandSlotHints()` returns `mode: 'gamepad'` after simulated delayed pad appearance post-gesture.

## Technical Specs

- **File:** `game/client/gamepad.js` — import activation module; extend `initGamepadListeners()` to register `onGamepadActivationChange` handler that mirrors connect/disconnect reset behavior.
- **File:** `game/client/main.js` — call `initGamepadActivation()` at module init; factor shared `handleGamepadConnectChange(gamepad)` used by both `window` event listeners and activation callback (updates `onGamepadConnectChange`, `renderHand`, `applyAttackHintText`, `renderKeyItemHud`, `resetHandLayoutLock`).
- **File:** `game/client/renderer.js` — ensure activation is initialized before or with `initGamepadListeners()` if startup order matters for the render loop.
- **File:** `game/client/controller-calibration.js` — optionally subscribe to activation changes to call `updateStatusDisplay(getCalibrationGamepad())` when settings overlay is open.
- **File:** `game/client/test/input.test.js` (or new test) — mock delayed pad: prime gesture → poll → assert gamepad mode hints.

## Verification: code
