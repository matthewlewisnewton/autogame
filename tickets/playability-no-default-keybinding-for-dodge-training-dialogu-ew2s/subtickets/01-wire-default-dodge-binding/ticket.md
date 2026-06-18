# Wire default dodge-roll keyboard binding

The `dodge` action exists in `game/client/input.js` but has an empty `DEFAULT_KEYBOARD` entry and no `onKeyDown` handler, so fresh players cannot dodge-roll despite training dialogue coaching them to. Give dodge a sensible default key (Space), route it through a new `onDodge` callback, and emit `useKeyItem` with `dodge_roll` from the client.

## Acceptance Criteria

- `DEFAULT_KEYBOARD.dodge` is a non-empty array with Space as the default (`' '` after `e.key.toLowerCase()`).
- Pressing the default dodge key during `gamePhase === 'playing'` invokes `onDodge` (not `onUseKeyItem`) and respects the same `canUseGameActions` gate and card-commitment guard as key-item input.
- `initInput` accepts an `onDodge` callback; `main.js` wires it to `socket.emit('useKeyItem', { keyItemId: 'dodge_roll' })`.
- When `dodge_roll` is the equipped key item, the in-run key-item HUD badge (`.key-item-hud-keybind`) shows the dodge binding label (`SPACE`), not the generic key-item binding (`E`).
- `getDodgeBinding()` is exported from `input.js` and returns the resolved keyboard key plus a display label.
- `getReservedKeys()` includes the default dodge key so it cannot collide with other fixed bindings.
- Unit tests in `game/client/test/input.test.js` cover default-key dodge firing and `getDodgeBinding()`.

## Technical Specs

- **`game/client/input.js`**
  - Set `dodge: [' ']` in `DEFAULT_KEYBOARD`.
  - In `onKeyDown`, after the `lockOn` branch, add an `action === 'dodge'` branch that calls `callbacks.onDodge?.()` with `e.preventDefault()`.
  - Extend the `initInput` opts JSDoc and `callbacks` object with `onDodge`.
  - Add `getDodgeBinding()` mirroring `getUseKeyItemBinding()` shape (`{ keyboard, display }`); default keyboard is `' '`, display is `'SPACE'`.
  - Ensure `getReservedKeys()` treats the dodge default like other fixed actions (include `' '` in the reserved set).
- **`game/client/main.js`**
  - Pass `onDodge` to `initInput` — same early-return guards as `onUseKeyItem` (`socket`, card commitment), but always emit `{ keyItemId: 'dodge_roll' }`.
  - In `renderKeyItemHud`, when `equippedId === 'dodge_roll'`, use `getDodgeBinding().display` (keyboard mode) instead of `getUseKeyItemBinding().keyboard`.
- **`game/client/test/input.test.js`**
  - Add tests: Space keydown triggers `onDodge`; dodge respects `canUseGameActions`; `getDodgeBinding()` returns Space/SPACE by default.

## Verification: code
