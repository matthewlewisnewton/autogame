# Key Item Input Bindings and Settings

Wire a dedicated **key item action** input separate from card slots, with defaults
and remapping in Settings.

## Difficulty: medium

## Goal

Players trigger their equipped key item via keyboard and gamepad using defaults
**E** (keyboard) and **D-pad Down** on the 8BitDo 64 profile (user-facing “D
button”; remappable). Standard gamepad profile gets a sensible default (e.g.
**button 13 / D-pad Down** in the standard mapping table).

## Problem

`input.js` `ACTIONS` only cover movement, card slots, and deck toggle. Settings
`gamepad.bindings` has no `useKeyItem` action; controls docs do not mention
utility items.

## Acceptance Criteria

- New action `useKeyItem` in `game/client/input.js` with defaults:
  - Keyboard: `e`
  - Standard gamepad: D-pad Down (btn 13) or documented alternative if 13 is
    unavailable on a profile
  - 8BitDo 64 profile: D-pad Down (align with standard D-pad button indices in
    `gamepad-profiles.js` button labels)
- Settings schema (`game/server/settings.js` defaults + PATCH merge) stores
  `keyboard.bindings.useKeyItem` and `gamepad.bindings.useKeyItem` overrides
  using the same deep-merge pattern as existing gamepad settings.
- Settings UI: remapping row for “Key item / utility” in the controls section
  (keyboard key capture + gamepad button picker reusing calibration patterns).
- `initInput` callback `onUseKeyItem` fires once per press (no repeat spam while
  held); respects `canUseGameActions()` (dungeon only, not lobby menus unless
  product decision says otherwise — **dungeon only** is fine for dodge).
- Client emits `useKeyItem` on the socket when the action fires during an active
  run (server handler from ticket 118).
- HUD-ready hook: export a function or event so ticket 120/121 can show the bound
  key glyph (reuse card-input-hint styling where possible).
- Tests: default binding maps `e`; patched settings change the key; gamepad binding
  resolution respects profile.
- Update `game/docs/controls.md` with key item binding and remapping.

## Implementation Notes

- Depends on **118-key-item-data-and-persistence** (`useKeyItem` socket exists).
- D-pad is also used for movement on standard pads — default is **tap-to-use**
  on the dedicated binding index, not stealing stick movement; document that users
  can remap if D-pad Down conflicts with their play style.
- Key files: `game/client/input.js`, `game/client/settings.js`,
  `game/client/gamepad-profiles.js`, `game/client/index.html` (settings panel),
  `game/server/settings.js`.

## Verification

- `Verification: code`
- Manual: press `e` in dungeon and confirm socket emit (server may no-op until 121).

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
