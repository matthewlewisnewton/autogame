# Add gamepad button binding for interact action

The `interact` action (keyboard F) has no gamepad binding — it's absent from `DEFAULT_GAMEPAD_BUTTONS`, `POLLABLE_ACTIONS`, and both gamepad profiles (`STANDARD_PROFILE`, `EIGHTBITDO_64_PROFILE`). As a result, no gamepad button can trigger hub booth interaction.

Bind D-pad Up (button index 12) as the interact button for both standard and 8BitDo 64 profiles. D-pad Up is unused by other actions and semantically matches "interact" (common convention in 3D games). Because interact fires in the lobby phase (not gated behind `canUseGameActions`), it must be polled outside the `actionsEnabled` gate in `pollInput()`, similar to how `lockOn` is already handled separately.

## Acceptance Criteria

- Pressing D-pad Up on a standard gamepad triggers the `onInteract` callback
- Pressing D-pad Up on an 8BitDo 64 gamepad triggers the `onInteract` callback
- The interact gamepad button fires in the lobby phase even when `canUseGameActions()` returns `false`
- Edge-triggered behavior: pressing once fires once; holding does not re-fire until release+press
- Existing tests in `input.test.js` still pass

## Technical Specs

**Files to change:**
- `game/client/input.js` — add `interact` to `DEFAULT_GAMEPAD_BUTTONS` (index 12); add special-case polling for `interact` outside the `actionsEnabled` gate in `pollInput()` (mirroring the `lockOn` pattern after the pollable-actions loop)
- `game/client/gamepad-profiles.js` — add `interact: { type: 'button', index: 12 }` to both `STANDARD_PROFILE.bindings` and `EIGHTBITDO_64_PROFILE.bindings`
- `game/client/test/input.test.js` — add tests for gamepad interact: (a) pressing D-pad Up fires `onInteract`, (b) interact fires when `canUseGameActions` returns `false`, (c) edge-triggered (no repeat on hold)

## Verification: code
