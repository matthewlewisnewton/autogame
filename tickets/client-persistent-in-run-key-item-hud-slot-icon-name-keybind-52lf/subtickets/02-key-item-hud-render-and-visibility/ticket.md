# 02 — Key item HUD render and visibility

Add client logic that populates the new HUD slot whenever the local player has `equippedKeyItemId` during `gamePhase === 'playing'`, showing the equipped item name, icon badge, and use-key-item binding hint while ready (off cooldown). Hide and clear the slot when no key item is equipped or when outside active dungeon play.

## Acceptance Criteria

- New `renderKeyItemHud(me, gamePhase)` (or equivalent) reads `keyItemDefs[equippedKeyItemId].name`, sets the icon badge from the equipped id, and shows the binding hint from `getUseKeyItemBinding()` — keyboard uppercase key when keyboard hints are active, `gamepadHint` when gamepad hints are active (mirror `getHandSlotInputHints()` mode detection).
- When equipped and playing with `getKeyItemCooldownRemainingMs(me) === 0`, `#key-item-indicator` has class `ready`, is visible (`opacity` / display per CSS), and displays name + keybind (cooldown child empty or hidden).
- When not equipped or `gamePhase !== 'playing'`, `clearKeyItemCooldownHud()` (or renamed helper) hides the indicator and clears slot content/classes.
- `renderKeyItemHud` is invoked from the existing `stateUpdate` playing branch (~1508–1517), on `keyItemEquipped`, and when use-key-item settings change (`syncUseKeyItemBindingUI` or settings patch callback) so keybind text updates live.
- Export `window.__renderKeyItemHudForTest(me, gamePhase)` (and keep existing `__setKeyItemDefs`) for unit tests.

## Technical Specs

- **`game/client/main.js`** — Implement `renderKeyItemHud`; query the child elements created in sub-ticket 01; import/use `getUseKeyItemBinding` and `isGamepadInputHintsActive` (or `getHandSlotInputHints`) from `input.js`; wire call sites listed above; stop setting `el.textContent = ''` on the root indicator in ready state (use child elements instead).
- **`game/client/index.html`** — No further changes expected if sub-ticket 01 landed; only touch if child selectors need `id`s for tests.
- **`game/client/style.css`** — Only touch if a small class toggle is needed for JS-driven visibility.

## Verification: code
