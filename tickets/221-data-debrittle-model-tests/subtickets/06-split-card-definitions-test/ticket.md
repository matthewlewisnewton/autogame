# 06-split-card-definitions-test

Move the `describe('new card pack definitions', …)` block out of the 567-line `new_card_pack.test.js` into a small dedicated test file so adding a new pack card touches one focused file instead of the monolith.

## Acceptance Criteria

- A new file `game/server/test/new_card_pack_definitions.test.js` exists containing the `describe('new card pack definitions', …)` block (all per-card type/field identity assertions and the `toMatchObject` checks currently in that block).
- `game/server/test/new_card_pack.test.js` no longer contains the `describe('new card pack definitions', …)` block — it retains only the `describe('new card combat helpers', …)` block and shared helper functions (`resetState`, `addPlayer`).
- Both test files import only the symbols they actually use (no unused imports left behind after the split).
- Full test suite still passes (`pnpm test:quick` — all 1754+ tests green).

## Technical Specs

- **`game/server/test/new_card_pack_definitions.test.js`** (new file) — move the `describe('new card pack definitions', …)` block verbatim. Imports needed: `CARD_DEFS` from `../index.js` and `SHOP_CARD_POOL` from `../config.js`. Does NOT need combat helper imports or simulation state (`gameState`, `createGameState`, `collectConeHits`, etc.).
- **`game/server/test/new_card_pack.test.js`** (edit) — delete the `describe('new card pack definitions', …)` block and the `SHOP_CARD_POOL` import (only used by the definitions block). Keep `DESPERATION_CARD_DEFS` (used by combat helpers at line ~190), the `resetState()` and `addPlayer()` helpers, and all combat helper imports.

## Verification: code
