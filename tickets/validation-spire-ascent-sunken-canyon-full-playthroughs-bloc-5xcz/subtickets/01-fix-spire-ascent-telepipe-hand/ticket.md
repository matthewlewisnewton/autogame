# Fix spire-ascent telepipe-ready hand: replace throw_rock with card from CARD_DEFS

`setupSpireAscentTelepipeReadyExtras` tries to place `throw_rock` in `hand[1]` by looking it up in `CARD_DEFS` (`shared/cardDefs.json`). `throw_rock` only exists in `DESPERATION_CARD_DEFS` (`progression.js`), so the lookup returns `undefined`, the guard `if (rockDef)` is skipped, and the hand ends up telepipe-only. The harness `depleteRunResources` step then fails with "No usable card to deplete resources".

Replace the `throw_rock` placeholder with `magma_greatsword`, which is available in `CARD_DEFS` and is the same weapon the preceding `magma-windup-ready` card exercise already uses.

## Acceptance Criteria

- `setupSpireAscentTelepipeReadyExtras` sets `hand[1]` to a `magma_greatsword` card (sourced from `CARD_DEFS.magma_greatsword`)
- After applying `spire-ascent-telepipe-ready` debug scenario, the player hand contains at least two non-null cards: `telepipe` in slot 0 and `magma_greatsword` in slot 1
- Existing test `spire-ascent-telepipe-ready deploys Tier 2 with telepipe in hand` continues to pass
- New test verifies `hand[1]` is a non-telepipe usable card (weapon or spell with `remainingCharges >= 1`)

## Technical Specs

- **File:** `game/server/debugScenarios.js`
  - In `setupSpireAscentTelepipeReadyExtras` (~L872-899): replace `CARD_DEFS.throw_rock` lookup with `CARD_DEFS.magma_greatsword`; update the card construction block to use `greatswordDef` and set `id: 'magma_greatsword'`
- **File:** `game/server/test/debug-scenarios.test.js`
  - In the `spire-ascent-telepipe-ready` test (~L1554): add assertion that `player.hand[1]` exists and has `id === 'magma_greatsword'` (or at minimum, `id !== 'telepipe'` and `remainingCharges >= 1`)

## Verification: code
