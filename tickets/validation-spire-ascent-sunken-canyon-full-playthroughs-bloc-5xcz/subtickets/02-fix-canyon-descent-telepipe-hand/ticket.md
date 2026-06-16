# Fix canyon-descent telepipe-ready hand: ensure usable damage card alongside telepipe

`canyon-descent-telepipe-ready` calls `setupQuestTelepipeReady` without an `afterDeploy` callback. The default branch finds the first occupied hand slot, replaces it with `telepipe`, and adds nothing else. When the preceding `magma-windup-ready` card exercise sets `player.hand = [magma_greatsword, null, ...]`, the only occupied slot gets replaced, leaving a telepipe-only hand. Passive deck redraw refills slots ~2s later, but the harness reads the hand immediately and fails with "No usable card to deplete resources".

Add an `afterDeploy` callback (mirroring the spire-ascent pattern) that places a `magma_greatsword` in `hand[1]` alongside the telepipe.

## Acceptance Criteria

- `canyon-descent-telepipe-ready` scenario passes an `afterDeploy` callback to `setupQuestTelepipeReady` that sets `hand[1]` to a `magma_greatsword` card
- After applying `canyon-descent-telepipe-ready` debug scenario, the player hand contains at least two non-null cards: `telepipe` in slot 0 and `magma_greatsword` in slot 1
- Existing test `canyon-descent-telepipe-ready deploys Tier 2 with telepipe in hand` continues to pass
- New test verifies `hand[1]` is a non-telepipe usable card (weapon or spell with `remainingCharges >= 1`)

## Technical Specs

- **File:** `game/server/debugScenarios.js`
  - Create a `setupCanyonDescentTelepipeReadyExtras(state, player)` helper (~L815 area, near `setupSpireAscentTelepipeReadyExtras`) that:
    - Sets `hand[1]` to a `magma_greatsword` card from `CARD_DEFS.magma_greatsword` (with `id`, `name`, `type`, `charges`, `remainingCharges` fields)
    - Clears any leftover `activeMinionId` / `burnMaxTtl` on hand cards
    - Calls `syncCardProbeHand(player)`
  - Modify `canyon-descent-telepipe-ready` scenario (~L4674) to pass `afterDeploy: setupCanyonDescentTelepipeReadyExtras` to `setupQuestTelepipeReady`
- **File:** `game/server/test/debug-scenarios.test.js`
  - In the `canyon-descent-telepipe-ready` test (~L1130): add assertion that `player.hand[1]` exists and has `id === 'magma_greatsword'` (or at minimum, `id !== 'telepipe'` and `remainingCharges >= 1`)

## Verification: code
