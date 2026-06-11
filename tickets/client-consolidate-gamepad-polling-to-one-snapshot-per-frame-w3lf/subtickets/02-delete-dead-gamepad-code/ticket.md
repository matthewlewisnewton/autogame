# Delete confirmed-dead gamepad-layer code and its orphan tests

Several gamepad helpers are confirmed dead: `uses8BitDo64DigitalCButtons()`
hardcodes `true`, which makes `get8BitDo64CStickAxes` / `get8BitDo64CAxisPairs`
always return `null` / `[]` (so analog cX/cY axis bindings can never activate);
`readAxisSectorDirections`, `readProfileCStick`, `isGamepadMoving`, and
`describeGamepadConnectionWithProfile` are unused outside tests; and `isButtonPressed`
in `input.js` duplicates `isGamepadButtonActive`. Remove them and their orphan tests,
inlining the always-true `uses8BitDo64DigitalCButtons()` calls at the one real call
site so behaviour is unchanged.

## Acceptance Criteria

- These exports are removed from `game/client/gamepad-profiles.js`:
  `uses8BitDo64DigitalCButtons`, `get8BitDo64CStickAxes`, `get8BitDo64CAxisPairs`,
  `readAxisSectorDirections`, `readProfileCStick`, `describeGamepadConnectionWithProfile`.
- Any code rendered dead by those removals is also cleaned up: the cX/cY branch of
  `readBindingAxisValue` (which depended on `get8BitDo64CStickAxes`, always returning
  0) is simplified or removed so no reference to a deleted function remains.
- `isGamepadMoving` is removed from `game/client/gamepad.js`.
- `isButtonPressed` is removed from `game/client/input.js`; its one caller
  (`isHandModifierHeld`) uses the existing `isGamepadButtonActive` from
  `gamepad-profiles.js` instead, preserving the `pressed || value > 0.5` semantics.
- `game/client/controller-calibration.js` no longer imports or calls
  `uses8BitDo64DigitalCButtons`; the two call sites (`hideSecondary` and the
  `profile.id === '8bitdo-64' && uses8BitDo64DigitalCButtons()` guard) are inlined to
  the equivalent always-true result, leaving calibration behaviour unchanged.
- Orphan tests for the deleted functions are removed from
  `game/client/test/gamepad-profiles.test.js` (the `uses8BitDo64DigitalCButtons`,
  `get8BitDo64CStickAxes`, `get8BitDo64CAxisPairs`, `readAxisSectorDirections`,
  `readProfileCStick` assertions and their now-unused imports).
- No remaining reference to any deleted symbol exists anywhere under `game/`
  (verifiable by grep returning no hits outside this ticket's own files).
- The full client test suite passes: `pnpm --filter @autogame/client test`.

## Technical Specs

- `game/client/gamepad-profiles.js`: delete `uses8BitDo64DigitalCButtons`,
  `get8BitDo64CStickAxes`, `get8BitDo64CAxisPairs`, `readAxisSectorDirections`,
  `readProfileCStick`, `describeGamepadConnectionWithProfile`. Simplify
  `readBindingAxisValue` so the `cX`/`cY` axis branch (which always returned 0) no
  longer calls the deleted `get8BitDo64CStickAxes`; keep plain numeric-axis binding
  support intact for `isBindingActive`. Drop the now-unused `is8BitDoGamepad` import
  if `describeGamepadConnectionWithProfile` was its only consumer (verify first).
- `game/client/gamepad.js`: delete the `isGamepadMoving` export.
- `game/client/input.js`: delete the local `isButtonPressed` function; import and use
  `isGamepadButtonActive` from `gamepad-profiles.js` inside `isHandModifierHeld`.
- `game/client/controller-calibration.js`: remove the `uses8BitDo64DigitalCButtons`
  import and inline both call sites (it always returned `true`).
- `game/client/test/gamepad-profiles.test.js`: remove the import and test cases
  covering the deleted functions.
- This is dead-code removal only — do not alter any live input/polling behaviour.

## Verification: code
