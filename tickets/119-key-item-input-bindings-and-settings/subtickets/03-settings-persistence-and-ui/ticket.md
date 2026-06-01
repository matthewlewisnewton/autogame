# Settings Persistence and UI for useKeyItem Bindings

Add `useKeyItem` to keyboard and gamepad binding defaults in settings, with a remapping row in the Settings UI.

## Acceptance Criteria

- Server `getDefaultSettings()` includes `keyboard: { bindings: { useKeyItem: 'e' } }` in defaults
- Client `getDefaultSettings()` includes `keyboard: { bindings: { useKeyItem: 'e' } }` in defaults
- Settings PATCH deep-merge correctly applies `keyboard.bindings.useKeyItem` and `gamepad.bindings.useKeyItem` overrides
- `input.js` reads `keyboard.bindings.useKeyItem` from settings (falls back to `DEFAULT_KEYBOARD`)
- Settings UI has a "Key item / utility" remapping row in the Controls section:
  - Keyboard: press-a-key capture (same pattern as existing key capture if any, or new minimal capture)
  - Gamepad: button picker reusing calibration button-grid pattern
- Patched keyboard binding changes the key that triggers `onUseKeyItem`

## Technical Specs

- **File**: `game/server/settings.js`
  - Add `keyboard: { bindings: { useKeyItem: 'e' } }` to `getDefaultSettings()` return
- **File**: `game/client/settings.js`
  - Add `keyboard: { bindings: { useKeyItem: 'e' } }` to `getDefaultSettings()` return
  - Add `getKeyboardBindings()` helper that returns `cachedSettings.keyboard?.bindings || {}`
- **File**: `game/client/input.js`
  - Import `getKeyboardBindings` from settings; in `onKeyDown`, check custom keyboard binding for `useKeyItem` before falling back to `DEFAULT_KEYBOARD`
  - Add `getUseKeyItemBinding()` export that returns the resolved keyboard key and gamepad button index for HUD consumption
- **File**: `game/client/index.html`
  - Add a "Key item / utility" remapping row inside the Controls settings section (after lock-on repeat press)
  - Keyboard key capture input + gamepad button label display
- **File**: `game/client/main.js`
  - Wire the remapping UI row: on keyboard key capture, call `patchSettings({ keyboard: { bindings: { useKeyItem: key } } })`
  - On gamepad button press in picker, call `patchSettings({ gamepad: { bindings: { useKeyItem: { type: 'button', index } } } })`

## Verification: code
