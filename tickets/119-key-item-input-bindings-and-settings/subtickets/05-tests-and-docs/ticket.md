# Tests and Documentation for useKeyItem Bindings

Add unit tests for `useKeyItem` input bindings and update the controls documentation.

## Acceptance Criteria

- Test: default keyboard binding for `useKeyItem` is `'e'`
- Test: pressing `e` fires `onUseKeyItem` callback exactly once (no repeat while held)
- Test: patched keyboard settings change the `useKeyItem` key
- Test: `useKeyItem` is NOT fired when `canUseGameActions()` returns `false`
- Test: default gamepad binding for `useKeyItem` is button 13 (D-pad Down) in Standard profile
- Test: 8BitDo 64 profile resolves `useKeyItem` to button 13 (Stick click — no D-pad on that hardware)
- Test: custom gamepad binding for `useKeyItem` overrides the profile default
- `game/docs/controls.md` documents the `useKeyItem` binding (keyboard `E`, gamepad D-pad Down) and mentions remappability in Settings

## Technical Specs

- **File**: `game/client/test/input.test.js`
  - Add tests in existing `describe('input.js')` block:
    - `keyboard e triggers onUseKeyItem` — dispatch `keydown` for `e`, verify callback fires once
    - `useKeyItem does not fire on key repeat` — dispatch `keydown` with `e.repeat = true`, verify callback does NOT fire
    - `useKeyItem respects canUseGameActions` — set `canUseGameActions: () => false`, press `e`, verify no callback
    - `patched keyboard binding changes useKeyItem key` — `patchSettings({ keyboard: { bindings: { useKeyItem: 'q' } } })`, press `q`, verify callback fires
    - `gamepad button 13 triggers onUseKeyItem` — mock gamepad with btn 13 pressed, `pollInput()`, verify callback
    - `8BitDo 64 profile maps useKeyItem to button 13` — set profile, mock 8BitDo gamepad with btn 13, verify callback
    - `custom gamepad binding overrides useKeyItem` — patch `gamepad.bindings.useKeyItem` to a different button, verify that button triggers
- **File**: `game/docs/controls.md`
  - Add a "Key Item" section documenting:
    - Keyboard: **E** (default, remappable in Settings)
    - Gamepad: **D-pad Down** (default, remappable in Settings)
    - 8BitDo 64: **D-pad Down** (same SDL index; remappable)
    - Action triggers the equipped key item (dodge roll, etc.) during dungeon runs

## Verification: code
