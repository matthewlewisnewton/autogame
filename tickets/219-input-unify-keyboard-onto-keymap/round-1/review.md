# Final Review: 219-input-unify-keyboard-onto-keymap

## Runtime Health

PASS. The captured run is valid: `metrics.json` reports `"ok": true`, the game reached the `playing` phase with two connected players, canvas rendering, movement probes, and key-item cooldown HUD data. `pageerrors` is empty, `pageerrors.json` is empty, and `console.log` contains no `pageerror` or `[fatal]` lines from game code. The Vite warning/EPIPE lines are benign harness/browser-close noise under the review rules.

Vitest coverage also completed successfully: 12 test files and 251 tests passed. The coverage log contains expected mocked missing-model stderr from existing tests, not a ticket-specific failure.

## Acceptance Criteria Findings

### 1. Make `input.js` the single keyboard owner

PARTIAL / BLOCKING. The duplicate renderer keyboard state, keydown/keyup listeners, and `getKeyboardMovement()` path were removed, and `renderer.js` now calls `getMovementDirection()` through `getMovementInput()`.

However, the implementation does not preserve the previous keyboard+gamepad movement merge. `input.js` computes keyboard direction first, but if `pollGamepadMovement()` returns any stick or D-pad vector, `getMovementDirection()` immediately returns the gamepad vector and drops active WASD state. Before this ticket, renderer movement used `mergeMovementVectors(getKeyboardMovement(), pollGamepadMovement(...))`, so simultaneous keyboard and gamepad input combined and clamped. This misses the criterion's requirement that the unified `getMovementDirection()` path merge keyboard and gamepad movement, and it regresses a working input combination.

### 2. Use `gamepad.js` `pollGamepadMovement` as the one stick reader

PASS. The local `readMoveStick()` helper was removed from `input.js`, and `renderer.js` no longer imports or directly calls `pollGamepadMovement()`. Stick/D-pad reading now flows through `gamepad.js`.

### 3. Add lock-on and dodge actions to input tables, dispatch lock-on through `onLockOn`

PASS. `ACTIONS` and `DEFAULT_KEYBOARD` include `lockOn` and `dodge`, keyboard `z` dispatches `onLockOn`, and `main.js` wires that callback to `renderer.applyLockOnPress()`. `applyLockOnPress()` remains in renderer and keeps its playing-phase guard.

### 4. Add typing target guard in `input.js` `onKeyDown`

PASS with a blocking regression. `onKeyDown` now ignores inputs from text fields/contenteditable targets, satisfying the requested guard.

The implementation also added the same guard to `onKeyUp`, which is unsafe for movement state. If a player holds a movement key, focuses a text input/settings field, and releases the key while that input is focused, the keyup is ignored and `keyState` remains stuck true until a later blur/visibility reset or another key cycle. The old renderer path only guarded keydown; keyup still cleared movement. This is a real movement-control regression.

### 5. Remove dead `setGamepadInputHandler` plumbing

PASS. `setGamepadInputHandler` and its empty registration in `main.js` are gone. Gamepad card/deck/key-item actions are handled through `input.js` polling.

### 6. Collapse redundant per-callback playing guards

PASS. The `initInput` callbacks now rely on `canUseGameActions()` for keyboard/gamepad dispatch gating, and the pointer/deck-stack paths use the shared helper instead of duplicating inline `gamePhase === 'playing'` checks. Lower-level invariants such as `useCard()` and `discardCard()` still retain their own state checks, which is appropriate.

## Design and Requirements

The implementation is consistent with the design document's lobby-to-dungeon flow and does not change combat, loot, persistence, or server simulation contracts. The captured run confirms the game still renders a Three.js scene, connects to the backend, visualizes multiplayer players, and moves via WASD in normal play.

The remaining issues are both in the client input layer. They affect the foundation movement requirement by regressing combined input behavior and allowing a stuck movement state in a focus-change edge case.

## Debug Scenarios

No development debug scenario was added or changed by this ticket. The capture used no `debugScenario` URL shortcut.

## Remaining gaps

1. `getMovementDirection()` does not merge keyboard and gamepad movement. Any active gamepad stick/D-pad vector early-returns and drops active WASD state, regressing the old `mergeMovementVectors(getKeyboardMovement(), pollGamepadMovement(...))` behavior and the top-level acceptance criterion.
2. Movement keyup is ignored when the event target is a typing target. Releasing a held movement key after focus moves into an input/contenteditable can leave `keyState` stuck true, causing continued movement until a later reset.

VERDICT: FAIL
