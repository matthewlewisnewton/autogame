# 03 — Key item HUD cooldown display and flash preservation

Integrate the existing cooldown pipeline with the persistent HUD slot so countdown seconds render in the dedicated cooldown child while name, icon, and keybind stay visible. Preserve `flashKeyItemIndicator` success / cooldown / soft-fail feedback on use and failed attempts.

## Acceptance Criteria

- `updateKeyItemCooldownHud(remainingMs)` toggles `.cooldown` vs `.ready` on `#key-item-indicator`, writes `(remainingMs / 1000).toFixed(1)` into `.key-item-hud-cooldown` (not root `textContent`), and leaves name/icon/keybind populated during cooldown.
- `getKeyItemCooldownRemainingMs` remains the single source for remaining time; `stateUpdate` playing tick and `KEY_ITEM_USED` / on-cooldown paths still call `updateKeyItemCooldownHud`.
- `flashKeyItemIndicator` still adds/removes `flash-success`, `flash-cooldown`, and `flash-soft-fail` on `#key-item-indicator` for ~450ms without destroying slot children.
- `clearKeyItemCooldownHud` removes `ready`/`cooldown`, clears cooldown text, and hides the slot (existing lobby / extract / run-end call sites unchanged).
- `window.__updateKeyItemCooldownHud` and `window.__flashKeyItemIndicator` test exports continue to work.

## Technical Specs

- **`game/client/main.js`** — Refactor `updateKeyItemCooldownHud`, `clearKeyItemCooldownHud`, and `flashKeyItemIndicator` (~3487–3534) to operate on child elements; ensure `renderKeyItemHud` and cooldown updates compose (either call render before cooldown update or merge into one `syncKeyItemHud(me, gamePhase)`).
- **`game/client/style.css`** — Adjust `.cooldown` rules if countdown typography must differ when nested in the new layout.
- **`game/client/test/key-item-dodge.test.js`** — Update existing cooldown/flash tests in this sub-ticket if assertions break due to DOM structure (minimal expectation fixes only).

## Verification: code
