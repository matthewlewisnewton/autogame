# Expose dodge-roll rebind in Settings and server schema

Players must be able to remap the dodge-roll key in Settings (matching the existing key-item rebind UX). The server settings validator currently rejects `keyboard.bindings.dodge` as an unknown action; add schema support, wire the client override path, and surface a Controls row in the settings overlay.

## Acceptance Criteria

- `KEYBOARD_BINDING_ACTIONS` in `game/server/settings.js` includes `'dodge'`; `validateSettings`, `backfillKeyboardBindings`, and `updateSettings` accept and persist a lowercase letter binding for dodge.
- `getDefaultSettings().keyboard.bindings` in `game/client/settings.js` does **not** need a dodge default (Space stays hardcoded in `DEFAULT_KEYBOARD`); a stored `dodge` binding overrides the default when present.
- `onKeyDown` in `input.js` checks `getKeyboardBindings().dodge` for the dodge action (same override pattern as `useKeyItem`).
- `getReservedKeys()` excludes `dodge` from the fixed reserved set (like `useKeyItem`) so remapped dodge keys are not double-reserved.
- Settings overlay (`index.html`) adds a **Dodge roll** binding row (`#dodge-key-input`) beside the existing key-item row, with key-capture logic in `main.js` mirroring `#use-key-item-key-input` (reserved-key conflict toast, blur/restore).
- `syncDodgeBindingUI()` (or equivalent) keeps the input showing the current binding; remapping updates HUD and `getDodgeBinding()` immediately.
- `game/docs/controls.md` documents the dodge-roll default (Space) and that it is remappable in Settings.
- Tests: `game/server/test/settings.test.js` accepts valid `dodge` bindings (replace the test that currently rejects `{ dodge: 'x' }`); `game/client/test/settings-layout.test.js` asserts the dodge row exists; `game/client/test/input.test.js` covers custom dodge override; `game/client/test/main.test.js` covers dodge key capture (mirror useKeyItem capture tests).

## Technical Specs

- **`game/server/settings.js`**
  - Add `'dodge'` to `KEYBOARD_BINDING_ACTIONS`.
  - Export unchanged API surface; backfill picks up dodge when stored.
- **`game/client/settings.js`**
  - No mandatory default entry for dodge in `getDefaultSettings()` (override-only); document in a brief comment if helpful.
- **`game/client/input.js`**
  - In `onKeyDown`, when `action === 'dodge'` and `kbBindings.dodge` is set, use `[kbBindings.dodge.toLowerCase()]` as `matchedKeys`.
  - Update `getDodgeBinding()` to prefer `kbBindings.dodge` when present; fall back to Space default.
  - Update `getReservedKeys()` to skip the `dodge` action (remappable).
- **`game/client/index.html`**
  - Add a `settings-binding-row` with label "Dodge roll", `#dodge-key-input` input, and a hint line (e.g. default Space, remappable).
- **`game/client/main.js`**
  - DOM refs, `syncDodgeBindingUI()`, focus/blur/keydown capture for `#dodge-key-input`, `patchSettings({ keyboard: { bindings: { dodge: key } } })`, call sync on settings load.
- **`game/docs/controls.md`**
  - Under Dodge Roll, add keyboard default **Space** and note Settings remapping.
- **Tests** (files listed above): adjust server rejection test, add layout/input/main capture coverage.

## Verification: code
