# 04-fix-debug-scenario-charges

Fix stale charge counts in the wind-up debug scenarios (`magma-windup-ready` and `flame-blade-windup-ready`) so they match the reduced charges from ticket 308. Currently `magma-windup-ready` injects Corebreaker Greatsword at 4/4 charges (should be 3/3) and `flame-blade-windup-ready` injects Solar Edge at 3/3 (should be 2/2). Derive charges from shared card definitions (`CARD_DEFS`) instead of hard-coding literals to prevent future drift.

## Acceptance Criteria

- `magma-windup-ready` debug scenario injects `magma_greatsword` with `charges: 3` and `remainingCharges: 3` (derived from `CARD_DEFS`)
- `flame-blade-windup-ready` debug scenario injects `flame_blade` with `charges: 2` and `remainingCharges: 2` (derived from `CARD_DEFS`)
- Both scenarios import `CARD_DEFS` (or `getCardDef`) from `./progression` and read `charges` from the card definition rather than hard-coding the literal
- Add a test asserting that the debug scenarios expose the correct reduced charge counts for both cards
- All existing tests still pass (`pnpm test`)

## Technical Specs

- **game/server/debugScenarios.js** — import `CARD_DEFS` from `./progression` (already imported; add to the destructuring at top of file). In the `magma-windup-ready` branch (~line 2255), replace the hand-built card literal with one that reads `charges` from `CARD_DEFS.magma_greatsword`. Similarly for `flame-blade-windup-ready` (~line 2277) using `CARD_DEFS.flame_blade`. Follow the pattern from `drawCardFromDeck()` in `progression.js` which builds `{ id: def.id, name: def.name, type: def.type, charges: def.charges, remainingCharges: def.charges }`.
- **game/server/test/debug_scenarios_charges.test.js** (new) — add tests that verify `CARD_DEFS.magma_greatsword.charges === 3` and `CARD_DEFS.flame_blade.charges === 2`, and that the debug scenario setup produces hand cards matching those values.

## Verification: code
