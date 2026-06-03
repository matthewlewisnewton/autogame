# Cover the Key Items lobby tab in setLobbyTab test

The existing `setLobbyTab` integration test in `main.test.js` covers shop, forge,
economy, and deck panels but never exercises `keyitems`. Extend it so the Key
Items panel's visibility/active wiring is locked in alongside the other tabs.

## Acceptance Criteria
- A vitest assertion exercises `setLobbyTab('keyitems')` (either inside the
  existing "switches between … tabs" test or a new `it(...)` in the same
  describe block).
- After `setLobbyTab('keyitems')`: `#key-item-loadout` is NOT hidden (no
  `hidden` class), and `#deck-editor`, `#card-shop`, `#photon-forge`, and
  `#card-economy` all ARE hidden.
- After `setLobbyTab('keyitems')`: `#lobby-tab-keyitems` has the `active` class.
- The full vitest suite passes (`pnpm test` from `game/`), including this new
  coverage.

## Technical Specs
- `game/client/test/main.test.js` — in the `describe('Photon Forge UI', …)`
  block (around lines 252–330):
  - Add `key-item-loadout`, `lobby-tab-keyitems`, `key-item-list`,
    `lobby-tab-medic`, and `guild-medic` to the `requiredIds` DOM-setup list in
    `beforeEach` so `setLobbyTab('keyitems')` and `renderKeyItemList()` have the
    elements they touch. (`lobby-tab-*` IDs already become `<button>` via the
    existing `id.startsWith('lobby-tab-')` branch.)
  - Add the `keyitems` assertions following the same pattern as the existing
    shop/forge/economy/deck blocks (toggle the tab, assert hidden/active
    classes).
- Reference implementation already in place: `setLobbyTab` at
  `game/client/main.js:2451` toggles `#key-item-loadout` and marks
  `#lobby-tab-keyitems` active; `renderKeyItemList()` at
  `game/client/main.js:2388` reads `#key-item-list`. No game code changes are
  needed — this is a test-only sub-ticket.

## Verification: code
