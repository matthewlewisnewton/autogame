# Reject reserved keys in useKeyItem key-capture UI

Wire the settings “Key item / utility” keyboard capture handler to refuse keys that collide with built-in actions, using `getReservedKeys()` and the existing `showCardErrorToast` helper. Valid rebinds must behave exactly as before.

## Acceptance Criteria

- In `game/client/main.js`, the `useKeyItemKeyInputEl` `keydown` capture handler (lines ~3640–3651) calls `getReservedKeys()` before `patchSettings`.
- Pressing a reserved key during capture (e.g. `1`, `w`, `z`) does **not** call `patchSettings`, does **not** change `keyboard.bindings.useKeyItem`, blurs/restores the input via `syncUseKeyItemBindingUI()`, and calls `showCardErrorToast` with a clear message (e.g. “Key already in use”).
- Pressing a non-reserved key (e.g. `q`, `u`, or `e`) still saves via `patchSettings` and updates the displayed binding as today.
- Modifier-only keys (`control`, `shift`, `alt`, `meta`, `capslock`, `tab`, `escape`) remain ignored with no toast.
- No change to in-game `onKeyDown` dispatch order or behavior for bindings that were already valid before this fix.
- `game/client/test/main.test.js` (or `input.test.js` if easier) includes tests that simulate capture: reserved key → no settings change + toast in DOM; valid key → binding updated.

## Technical Specs

- **`game/client/main.js`**
  - Import `getReservedKeys` from `./input.js`.
  - In the capture `keydown` handler, after normalizing `key` with `.toLowerCase()`, if `getReservedKeys().has(key)` (or equivalent), call `showCardErrorToast(...)`, reset capture state, blur, `syncUseKeyItemBindingUI()`, and `return` without `patchSettings`.
- **`game/client/test/main.test.js`**
  - Add a describe block for useKeyItem key capture: focus `#use-key-item-key-input`, dispatch `keydown` with a reserved key, assert `getSettings().keyboard.bindings.useKeyItem` unchanged and a toast element with the rejection message exists; repeat with a free key and assert binding updates.

## Verification: code
