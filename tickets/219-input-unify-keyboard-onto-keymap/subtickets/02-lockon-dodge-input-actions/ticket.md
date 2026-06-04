# Route lock-on and dodge through input.js actions

Add `lockOn` and `dodge` to the `ACTIONS` / `DEFAULT_KEYBOARD` tables in `input.js`, wire keyboard and gamepad lock-on press edges through `initInput` callbacks, and remove the hardcoded `z` key handler from `renderer.js`. `renderer.applyLockOnPress()` stays in the renderer; only dispatch moves to `input.js` + `main.js`.

## Acceptance Criteria

- `input.js` exports `lockOn` and `dodge` in `ACTIONS`; `DEFAULT_KEYBOARD` binds `lockOn` to `['z']` and includes a `dodge` entry (empty `[]` default — reserved slot for future remapping; dodge roll remains on `useKeyItem` / `e` for now).
- `initInput()` accepts an `onLockOn` callback; pressing `z` (when `canUseGameActions()` is true, not repeating, and not typing) calls `onLockOn()`.
- Gamepad lock-on edge detection moves out of the renderer animate loop: `pollGamepadButtons().lockOn` (or equivalent logic inside `input.js`) triggers `onLockOn()` when actions are enabled.
- `renderer.js` no longer registers a `keydown` handler for `'z'` / `applyLockOnPress`; lock-on is not triggered from renderer keyboard listeners.
- `main.js` passes `onLockOn: () => applyLockOnPress()` (imported from renderer) in the `initInput({ ... })` call.
- `getActionLabels()` includes a label for `lockOn` (and `dodge` if exposed in settings UI later).
- Lock-on smoke behavior unchanged: Z and gamepad L-trigger / 8BitDo Z still acquire/release targets via `applyLockOnPress`.

## Technical Specs

- **`game/client/input.js`**
  - Extend `ACTIONS`, `DEFAULT_KEYBOARD`, and `getActionLabels()`.
  - Add `onLockOn` to the callbacks object and handle `lockOn` in `onKeyDown` (edge-triggered, respect `canUseGameActions`, `e.preventDefault()`).
  - Extend `pollInput()` (or add a dedicated export called from the render loop) to poll gamepad lock-on via `pollGamepadButtons()` from `gamepad.js` and fire `onLockOn` on rising edge when actions enabled.
- **`game/client/renderer.js`**
  - Remove any remaining `keydown`/`keyup` listener block tied to lock-on (if sub-ticket 01 left a Z branch, delete it here).
  - Remove the direct `if (currentGamePhase === 'playing' && gamepadActions.lockOn) applyLockOnPress()` block from `animate()` once dispatch lives in `input.js`.
  - Keep `applyLockOnPress()` exported and unchanged in behavior.
- **`game/client/main.js`**
  - Import `applyLockOnPress` from `./renderer.js` (if not already).
  - Add `onLockOn: () => applyLockOnPress()` to `initInput({ ... })`.
- **`game/client/test/input.test.js`**
  - Add tests: `z` fires `onLockOn` once per press when `canUseGameActions` is true; does not fire when false; gamepad lock-on edge triggers `onLockOn`.

## Verification: code
