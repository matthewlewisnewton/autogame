# 04-split-card-identity-tests

Extract per-card identity assertions (type, stats, existence) from the 567-line `new_card_pack.test.js` into a small dedicated test file so that adding a new card touches only one small file rather than the large combat-helpers test.

## Acceptance Criteria

- A new file `game/server/test/card_registry.test.js` exists and contains all per-card identity checks: existence of each card id in `CARD_DEFS`, type assertions (`weapon`, `spell`, `creature`), and stat-level checks (e.g., `saber_of_light.cooldownMs < COOLDOWN_MS`, `excalibur_photon.damage` relation, `permafrost_lance` stats, `SHOP_CARD_POOL` membership).
- `game/server/test/new_card_pack.test.js` no longer contains the `new card pack definitions` describe block; it retains only the `new card combat helpers` block (behavioral tests using `gameState`, `collectConeHits`, `applyFreezeInRadius`, etc.).
- Both test files pass independently.
- The total number of passing tests across the suite is unchanged (tests moved, not deleted).

## Technical Specs

- **New file**: `game/server/test/card_registry.test.js`
  - Import `CARD_DEFS`, `DESPERATION_CARD_DEFS`, `COOLDOWN_MS` from `../index.js` and `SHOP_CARD_POOL` from `../config.js`.
  - Move the entire `describe('new card pack definitions', ...)` block from `new_card_pack.test.js` into this file.
  - This includes: the 11-card existence + type check, Permafrost Lance stats, shop pool membership, Saber of Light cooldown, Excalibur Photon inheritance stats, and any other stat-level assertions that don't mutate `gameState`.
- **Modified file**: `game/server/test/new_card_pack.test.js`
  - Remove the `describe('new card pack definitions', ...)` block and its imports if they become unused (keep `COOLDOWN_MS` if still referenced by combat helper tests).
  - The `resetState()` and `addPlayer()` helpers stay since combat helper tests need them.

## Verification: code
