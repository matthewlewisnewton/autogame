# Profile-aware gamepad hint for key item binding

`getUseKeyItemBinding()` in `game/client/input.js` always labels the default
gamepad button via `STANDARD_BUTTON_HINTS` (e.g. "DPad Down" for index 13),
even when the active gamepad profile is 8BitDo 64 where index 13 is
"Stick click". Make the hint resolve against the active profile's
`buttonLabels` so N64-layout players see the correct physical control in the
settings UI.

## Acceptance Criteria

- When the active gamepad profile is `8bitdo-64` (explicitly configured OR
  auto-detected as 8BitDo), `getUseKeyItemBinding().gamepadHint` uses that
  profile's `buttonLabels` entry for the resolved gamepad index (index 13 →
  "Stick click").
- When the active profile is standard (or no 8BitDo gamepad is present),
  `gamepadHint` keeps the existing `STANDARD_BUTTON_HINTS` behavior (index 13 →
  "DPad Down"), falling back to `Btn N` for unmapped indices.
- A unit test in `game/client/test/input.test.js` asserts the 8BitDo profile
  hint text ("Stick click") differs from the standard profile hint
  ("DPad Down") for the same default index.
- All existing `getUseKeyItemBinding` tests in `input.test.js` still pass.

## Technical Specs

- `game/client/input.js`:
  - In `getUseKeyItemBinding()` (around line 423), after resolving
    `gamepadIndex`, determine the active profile. Reuse the existing
    `is8BitDo64HandHintsActive()` helper (already exported in this file) to
    decide whether the 8BitDo layout is active. When it is, look up the label
    from `EIGHTBITDO_64_PROFILE.buttonLabels` (find the entry whose `index`
    matches `gamepadIndex`) and use it for `gamepadHint`; otherwise keep the
    `STANDARD_BUTTON_HINTS[gamepadIndex] ?? `Btn ${gamepadIndex}`` path.
  - Import `EIGHTBITDO_64_PROFILE` from `./gamepad-profiles.js` (the import
    block at the top already pulls several symbols from that module).
  - If a custom-bound index has no matching `buttonLabels` entry under the
    8BitDo profile, fall back to `Btn ${gamepadIndex}`.
- `game/client/gamepad-profiles.js`: read-only reference — `EIGHTBITDO_64_PROFILE.buttonLabels`
  maps index 13 → "Stick click".
- `game/client/test/input.test.js`: add a test that forces the 8BitDo profile
  (e.g. via the gamepad config / `setGamepadConfig({ profile: '8bitdo-64' })`
  as other tests in this file do) and asserts `gamepadHint === 'Stick click'`,
  contrasted with the standard-profile default of `'DPad Down'`.

## Verification: code
