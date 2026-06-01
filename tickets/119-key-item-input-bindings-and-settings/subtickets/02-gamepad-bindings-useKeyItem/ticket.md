# Add useKeyItem Gamepad Bindings

Wire `useKeyItem` into gamepad profiles (Standard + 8BitDo 64) and the `pollInput()` loop.

## Acceptance Criteria

- `STANDARD_PROFILE.bindings.useKeyItem` maps to D-pad Down (button 13)
- `EIGHTBITDO_64_PROFILE.bindings.useKeyItem` maps to button 13 (Stick click — 8BitDo 64 has no D-pad; button 13 is the closest SDL-aligned index per `gamepad-profiles.js` labels)
- `DEFAULT_GAMEPAD_BUTTONS` in `input.js` includes `useKeyItem: 13`
- `POLLABLE_ACTIONS` includes `useKeyItem` so `pollInput()` dispatches it
- `pollInput` fires `callbacks.onUseKeyItem?.()` on edge-trigger (press, not hold-repeat)
- Gamepad `useKeyItem` respects `canUseGameActions()` guard

## Technical Specs

- **File**: `game/client/gamepad-profiles.js`
  - Add `useKeyItem: { type: 'button', index: 13 }` to `STANDARD_PROFILE.bindings`
  - Add `useKeyItem: { type: 'button', index: 13 }` to `EIGHTBITDO_64_PROFILE.bindings` (Stick click on 8BitDo 64; document as remappable since 8BitDo 64 lacks a D-pad)
- **File**: `game/client/input.js`
  - Add `useKeyItem: 13` to `DEFAULT_GAMEPAD_BUTTONS`
  - `POLLABLE_ACTIONS` auto-picks up new keys from `DEFAULT_GAMEPAD_BUTTONS` (already `Object.keys`)
  - In `pollInput()`, add handling for `useKeyItem` action: when edge-triggered, call `callbacks.onUseKeyItem?.()` (same pattern as `toggleDeckViewer`)

## Verification: code
