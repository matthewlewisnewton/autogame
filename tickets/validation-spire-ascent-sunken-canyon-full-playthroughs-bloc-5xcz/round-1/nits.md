## Deduplicate telepipe-ready extras helpers

`setupSpireAscentTelepipeReadyExtras` and `setupCanyonDescentTelepipeReadyExtras` in `debugScenarios.js` are nearly identical (telepipe in slot 0, magma_greatsword in slot 1, minion cleanup, syncCardProbeHand). A shared `setupQuestTelepipeReadyExtras(state, player)` would reduce drift between quest presets.

### Acceptance Criteria

- Single helper used by both spire-ascent and canyon-descent telepipe-ready scenarios
- Existing telepipe-ready unit tests continue to pass

## Harden spire-ascent telepipe hand guarantee

Spire-ascent full playthrough currently passes because deck-dealt cards (e.g. `dungeon_drake` in slot 2) remain usable after the telepipe scenario, not because `hand[1]` reliably holds `magma_greatsword`. The same `ensurePlayerCombatHand` skip that breaks canyon could make spire flaky if deck composition changes.

### Acceptance Criteria

- After `spire-ascent-telepipe-ready` in a fromPlaying full-flow run (post windup exercise), harness `readHarness` shows `hand[1].id === 'magma_greatsword'` with `remainingCharges >= 1` immediately before `depleteRunResources`
