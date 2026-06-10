# Honor 8BitDo 64 useSlot remaps in hand badges and attack/cast hint

The 8BitDo 64 branch of `getHandSlotInputHints()` consults the static
`EIGHTBITDO_64_SLOT_HINTS[action]` map via `??` BEFORE the binding-resolution
helper, so a remapped `useSlotN` binding is always overwritten by the default
A/B/C labels. As a result the displayed hand badges and the device-aware
`getAttackCastHint()` text both show the wrong button for remapped 8BitDo 64
slots. Resolve the binding first, falling back to the static label only when no
binding is set.

## Acceptance Criteria

- When an 8BitDo 64 `useSlotN` action is remapped (custom `cfg.bindings.useSlotN`
  via `getBindingForAction`), `getHandSlotInputHints()` returns the hint/label of
  the RESOLVED binding (e.g. a remapped C-button direction or face A/B), not the
  default `EIGHTBITDO_64_SLOT_HINTS` / `EIGHTBITDO_64_SLOT_HINT_LABELS` value for
  that slot index.
- With no remap (default 8BitDo 64 profile), the badges/labels are unchanged
  from current behavior (A, B, C-up, C-down, C-left, C-right).
- `getAttackCastHint()` for the 8BitDo 64 profile reflects the remapped slot-0
  attack button and the remapped first/last cast-range labels.
- New tests in `game/client/test/attack-cast-hint.test.js` prove a remapped
  8BitDo 64 `useSlot0` (attack) and a remapped `useSlotN` cast slot change both
  `getHandSlotInputHints()` output and `getAttackCastHint()` text; existing
  default-profile tests still pass.
- `game/client/test/input.test.js` covers a remapped 8BitDo 64 `useSlotN`
  binding flowing through `getHandSlotInputHints()` (hints and hintLabels).

## Technical Specs

- `game/client/input.js`, `getHandSlotInputHints()`: in the
  `profile.id === '8bitdo-64'` branch, replace
  `EIGHTBITDO_64_SLOT_HINTS[action] ?? describe8BitDo64HandSlotBindingHint(binding, i)`
  with a binding-first resolution — call
  `describe8BitDo64HandSlotBindingHint(binding, i)` (and
  `describe8BitDo64HandSlotBindingHintLabel(binding, i)` for labels) directly.
  Those helpers already describe a resolved `cButton`/`button` binding and only
  fall back to `EIGHTBITDO_64_SLOT_HINTS` / `EIGHTBITDO_64_SLOT_HINT_LABELS`
  when `binding` is null, so default-profile output is preserved.
- Do NOT change `describe8BitDo64HandSlotBindingHint` /
  `describe8BitDo64HandSlotBindingHintLabel` themselves — only how the branch
  calls them. The standard-profile branch is already binding-first and stays as
  is.
- `game/client/test/attack-cast-hint.test.js` and
  `game/client/test/input.test.js`: add the tests described above, setting a
  custom 8BitDo 64 gamepad binding (via the gamepad config used by
  `getBindingForAction`) for the remapped slots.

## Verification: code
