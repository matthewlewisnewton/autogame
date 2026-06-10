# 04 — Key item HUD client tests

Add focused vitest coverage for the persistent key item HUD: ready (equipped + playing), cooldown countdown, unequipped / lobby hidden, and flash feedback — satisfying the top-level ticket’s test requirement.

## Acceptance Criteria

- Tests cover **ready**: with `equippedKeyItemId` set, `gamePhase: 'playing'`, and zero cooldown, `#key-item-indicator` is visible with class `ready`, shows the def name (e.g. Dodge Roll) and binding hint (default `E`).
- Tests cover **cooldown**: `__updateKeyItemCooldownHud(700)` shows `.cooldown`, countdown text `0.7` in the cooldown child, and name/keybind still present.
- Tests cover **unequipped / not playing**: no equipped id or `gamePhase: 'lobby'` leaves the indicator hidden/cleared (no `ready`/`cooldown`, empty cooldown child).
- Tests cover **flash**: `__flashKeyItemIndicator('success'|'cooldown'|'soft-fail')` toggles the expected class without removing HUD children.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/client/test/key-item-dodge.test.js`** — Extend the existing `key item cooldown HUD` describe block (or add a sibling describe) using `ensureMainDom`, `__setKeyItemDefs`, `__setGameState`, `__renderKeyItemHudForTest`, `__updateKeyItemCooldownHud`, `__flashKeyItemIndicator`.
- **`game/client/main.js`** — Only if test hooks from sub-tickets 02–03 are missing; add minimal exports required by tests.
- No server changes.

## Verification: code
