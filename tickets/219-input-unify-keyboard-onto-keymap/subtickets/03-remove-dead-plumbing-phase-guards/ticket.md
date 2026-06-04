# Remove dead gamepad handler plumbing and redundant phase guards

Delete the unused `setGamepadInputHandler` export and its empty registration in `main.js`. Collapse redundant `gamePhase === 'playing'` checks inside `initInput` callbacks now that `canUseGameActions` gates action dispatch.

## Acceptance Criteria

- `renderer.js` has no `gamepadInputHandler` variable, no `setGamepadInputHandler()` export, and no `gamepadInputHandler(...)` call in `animate()`.
- `main.js` does not import or call `setGamepadInputHandler`; the empty callback block at ~2974 is removed.
- `initInput` callbacks in `main.js` drop inner `gameState.gamePhase === 'playing'` guards where `canUseGameActions` already covers the same condition:
  - `onToggleDeck` (~766): call `toggleDeckViewer()` directly.
  - `onUseKeyItem` (~769): remove the outer phase check; keep socket/key-item logic.
- Redundant phase checks at `main.js` ~3014 (canvas pointerdown basic attack) and ~3023 (`deckStackEl` click) are removed or replaced with a shared `canUseGameActions()`-style helper so phase gating is not duplicated inline.
- `pnpm test:quick` passes; no references to `setGamepadInputHandler` remain in `game/client/`.

## Technical Specs

- **`game/client/renderer.js`**
  - Delete `gamepadInputHandler`, `setGamepadInputHandler`, and the handler invocation in `animate()` (lock-on dispatch should already live in `input.js` from sub-ticket 02).
  - Remove `pollGamepadButtons` import from `animate()` if it becomes unused after lock-on dispatch moves to `input.js`.
- **`game/client/main.js`**
  - Remove `setGamepadInputHandler` import and the no-op registration.
  - Simplify `onToggleDeck` and `onUseKeyItem` callbacks per acceptance criteria.
  - For canvas pointerdown (~3012) and `deckStackEl` click (~3021): extract a local `function canPlayInDungeon()` (or reuse the same predicate as `canUseGameActions`) and use it instead of inline `gameState && gameState.gamePhase === 'playing'` checks.
- **`game/client/test/main.test.js`**
  - Update any tests that stub or assert on `setGamepadInputHandler` if present.

## Verification: code
