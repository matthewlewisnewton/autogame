# Force fresh hand redeal in telepipe-ready scenarios when applied over existing hand

When `canyon-descent-telepipe-ready` (and `spire-ascent-telepipe-ready`) runs via the `fromPlaying` full-flow path after the `magma-windup-ready` card exercise, `ensurePlayerCombatHand` skips re-dealing because `player.hand` already has six slots. The `afterDeploy` extras set `hand[0]=telepipe` and `hand[1]=magma_greatsword`, but the harness still observes telepipe-only or telepipe-plus-depleted-creature hands at depletion time, causing `No usable card to deplete resources`.

Add a `forceRedeal` option to `setupQuestTelepipeReady` that clears the hand before `ensurePlayerCombatHand` runs, forcing a fresh deck + hand deal. Wire `forceRedeal: true` for both canyon-descent and spire-ascent telepipe-ready scenarios so the extras always apply on a clean hand.

## Acceptance Criteria

- `setupQuestTelepipeReady` accepts a `forceRedeal` option; when `true`, it clears `player.hand` (sets to `null`) before `setupQuestTier2Deploy` calls `ensurePlayerCombatHand`, forcing a fresh `createDrawDeckFromSelectedDeck` + `initPlayerHand`
- `canyon-descent-telepipe-ready` scenario passes `forceRedeal: true` to `setupQuestTelepipeReady`
- `spire-ascent-telepipe-ready` scenario passes `forceRedeal: true` to `setupQuestTelepipeReady`
- After applying either telepipe-ready scenario (even over a pre-existing non-empty hand), the player hand contains `telepipe` in slot 0 and `magma_greatsword` (with `remainingCharges >= 1`) in slot 1
- Sunken-canyon full playthrough completes end-to-end: `node ../harness/validate/playthrough.mjs --preset sunken-canyon --steps full` exits 0 with all assertions passing
- Existing unit tests `canyon-descent-telepipe-ready deploys Tier 2 with telepipe in hand` and `spire-ascent-telepipe-ready deploys Tier 2 with telepipe in hand` continue to pass
- New unit test verifies that applying `canyon-descent-telepipe-ready` over a pre-existing hand (simulating `fromPlaying` path with a 6-slot hand containing a single card) still yields `hand[0]=telepipe` and `hand[1]=magma_greatsword`

## Technical Specs

- **File:** `game/server/debugScenarios.js`
  - `setupQuestTelepipeReady` (~L816): add `forceRedeal` to the options destructured parameter; when `forceRedeal` is true, set `player.hand = null` **before** calling `setupQuestTier2Deploy` so that `ensurePlayerCombatHand` inside `setupQuestTier2Deploy` sees a null hand and triggers `createDrawDeckFromSelectedDeck` + `initPlayerHand`
  - `canyon-descent-telepipe-ready` scenario (~L4706): add `forceRedeal: true` to the options passed to `setupQuestTelepipeReady`
  - `spire-ascent-telepipe-ready` scenario (~L4763): add `forceRedeal: true` to the options passed to `setupQuestTelepipeReady`
- **File:** `game/server/test/debug-scenarios.test.js`
  - Add a test that connects a client, manually sets `player.hand` to a 6-slot array with one non-null card (simulating post-windup state), then emits `canyon-descent-telepipe-ready` and asserts `hand[0].id === 'telepipe'` and `hand[1].id === 'magma_greatsword'` with `remainingCharges >= 1`

## Verification: code
