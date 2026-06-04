## Runtime health

The captured run loaded cleanly. `metrics.json` reports `ok: true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains no `pageerror` or `[fatal]` lines from game code; the observed 409 resource messages are non-fatal and did not prevent the lobby-to-gameplay capture from completing.

The fallback capture exercised normal gameplay from auth/lobby through ready-up, WASD movement, and dodge/key-item cooldown. Probes show `phase: "playing"`, a live canvas, connected socket state, visible hand UI, movement from the spawn position, and active then cleared key-item cooldown.

## Acceptance criteria

1. **Make `input.js` the single keyboard owner:** Satisfied. The renderer's WASD `keys` map, keydown/keyup listeners, and `getKeyboardMovement()` path were removed. Renderer movement and facing now call `getMovementDirection()` from `input.js`, and the only remaining renderer input reset listener delegates to `resetInputState()`.

2. **Use `gamepad.js` as the one stick reader:** Satisfied. `input.js` removed its local `readMoveStick()` implementation and calls `pollGamepadMovement()` from `gamepad.js`, preserving configured deadzone and selected stick behavior.

3. **Route lock-on and reserve dodge through input actions:** Satisfied. `ACTIONS` and `DEFAULT_KEYBOARD` now include `lockOn` and `dodge`; keyboard `z` dispatches through `onLockOn`, and renderer `applyLockOnPress()` remains the lock-on behavior owner. Gamepad lock-on is also edge-polled from `input.js`.

4. **Add typing-target guard in `input.js`:** Satisfied. `onKeyDown()` ignores input/textarea/contenteditable targets, preventing gameplay actions and movement from being started while typing. `onKeyUp()` still clears movement keys, which avoids stuck movement if focus changes after a movement keydown.

5. **Remove dead gamepad handler plumbing:** Satisfied. `setGamepadInputHandler`, `gamepadInputHandler`, and the empty main.js registration are gone; `pollInput()` is the single per-frame gamepad action dispatcher.

6. **Collapse redundant per-callback phase guards:** Satisfied. `main.js` centralizes action gating in `canUseGameActions()` for `initInput()` callbacks and uses the same helper for pointer/deck interactions. Renderer still guards `applyLockOnPress()` internally, which is appropriate because the function is exported and can be called independently.

## Design and requirements fit

The implementation stays within the existing client input architecture and does not alter server simulation, persistence, dungeon flow, or combat rules. It preserves the requirement that WASD movement updates the local player and broadcasts through the existing renderer movement pipeline, while reducing duplicate hardware readers that could diverge.

No new debug scenario was added or changed for this ticket. The capture used the normal gameplay path, not a `debugScenario` shortcut.

## Code quality and verification

The changed code is focused and covered by targeted unit tests. `coverage.log` shows the Vitest suite passed: 12 files and 253 tests. The new input tests cover keyboard movement, typing-target keyup clearing, merged keyboard/gamepad movement, keyboard and gamepad lock-on dispatch, exposed action labels, and existing key-item binding behavior.

I did not find dead replacement code, duplicate keyboard listeners, uncaught runtime errors, or integration issues in the live `game/` files.

## Remaining gaps

None.

VERDICT: PASS
