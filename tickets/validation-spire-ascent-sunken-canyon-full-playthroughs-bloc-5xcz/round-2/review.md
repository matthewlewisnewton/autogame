# Senior Review — validation-spire-ascent-sunken-canyon-full-playthroughs-bloc-5xcz

## Runtime health

Round-2 capture is clean:

- `metrics.json`: `"ok": true`, empty `pageerrors`, no `harness_failure`, no `failure_kind`.
- `console.log`: no `pageerror` or `[fatal]` lines; only benign Vite connect logs, a 409 on an auth resource (non-fatal), and normal game init / debug-scenario / launch-booth messages.
- Browser probes show telepipe suspend → suspended lobby → resume with enemy/layout preservation (`preservation.preservedIds: 2`, `missingIds: []`).

The game starts and loads cleanly in the captured run.

## Per-criterion findings

### 1. Spire-ascent full Tier-2 playthrough completes end-to-end

**Met.** Independent verification:

```bash
node ../harness/validate/playthrough.mjs --preset spire-ascent --steps full --out /tmp/qa-spire-review
```

Exit code 0; all assertions true: `bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`, `bossEncounterUiVisible`, `bossDistinctFromAdds`, card-exercise probes, `telepipeVitalsPreserved`, `cardChargesResetOnNewSortie`.

The `spireTelepipe` block confirms the `fromPlaying` telepipe-new-sortie path ran after card exercises (including `magma-windup-ready`) without the prior `"No usable card to deplete resources"` failure.

### 2. Sunken-canyon full Tier-2 playthrough completes end-to-end

**Met.** Independent verification:

```bash
node ../harness/validate/playthrough.mjs --preset sunken-canyon --steps full --out /tmp/qa-canyon-review
```

Exit code 0 with the same full assertion set passing, including `canyonTelepipe.telepipeVitalsPreserved` and `cardChargesResetOnNewSortie`.

### 3. Root cause — telepipe-only hand after `magma-windup-ready` in `fromPlaying` flow

**Fixed.** Three coordinated changes in `game/server/debugScenarios.js` (commits `9600f421`, `99a1401e`, `08243168`):

| Issue | Fix |
| --- | --- |
| `setupSpireAscentTelepipeReadyExtras` looked up `CARD_DEFS.throw_rock` (only in `DESPERATION_CARD_DEFS`) | Replaced with `CARD_DEFS.magma_greatsword` in `hand[1]` |
| `canyon-descent-telepipe-ready` had no `afterDeploy`; default branch replaced the lone windup card with telepipe only | Added `setupCanyonDescentTelepipeReadyExtras` mirroring spire pattern |
| `ensurePlayerCombatHand` skipped redeal when a 6-slot hand already existed | Added `forceRedeal: true` option that clears `player.hand` before deploy for both quest telepipe scenarios |

The `forceRedeal` gate in `setupQuestTelepipeReady` correctly runs **before** `setupQuestTier2Deploy` so `ensurePlayerCombatHand` deals a fresh deck, then `afterDeploy` pins telepipe + magma_greatsword.

### 4. Unit test coverage for the fix

**Met.** `game/server/test/debug-scenarios.test.js`:

- Extended `canyon-descent-telepipe-ready` and `spire-ascent-telepipe-ready` tests to assert `hand[1].id === 'magma_greatsword'` with `remainingCharges >= 1`.
- New test `canyon-descent-telepipe-ready forces fresh hand redeal over pre-existing hand` simulates the post-windup single-card hand and confirms telepipe + greatsword after scenario apply.

Round-2 `coverage.log`: 67/67 debug-scenario tests passed.

### 5. Consistency with design docs

**No regressions.** Changes are confined to harness debug scenarios (`spire-ascent-telepipe-ready`, `canyon-descent-telepipe-ready`). Normal telepipe suspend/resume/new-sortie semantics in `game/docs/design.md` are unchanged. Debug scenarios remain localhost-gated via `isDebugScenarioAllowed` in `game/server/index.js` (`ALLOW_DEBUG_SCENARIOS=1` or loopback address only).

### 6. Debug scenario integrity

**Pass.**

- **Gating:** Scenarios are only reachable via `?debugScenario=NAME` (client) or harness `debugScenario` socket emit; `isDebugScenarioAllowed` blocks production/non-localhost use.
- **Normal path preserved:** Telepipe-new-sortie in real play still flows through combat → telepipe extract → hub suspend → abort sortie → fresh deploy. Debug scenarios only seed QA hand state; they do not bypass server validation, checkpoint persistence, or abandon/redeploy logic exercised by `harness/validate/lib/telepipe.mjs`.
- **No invariant weakening:** `forceRedeal` affects only debug-scenario setup; it is not exposed to normal deploy or `checkAllReady` paths.

## Code quality

- Focused diff: two production files (`debugScenarios.js`, `debug-scenarios.test.js`), ~50 lines of logic.
- `setupSpireAscentTelepipeReadyExtras` and `setupCanyonDescentTelepipeReadyExtras` are nearly identical — acceptable for a targeted bugfix, but see nits for a possible DRY follow-up.
- No dead code introduced; `throw_rock` reference correctly removed from spire extras.
- Independent full playthrough runs confirm integration beyond unit tests.

## Remaining gaps

None. Runtime capture is clean, both prescribed playthrough commands pass with all assertions, and the telepipe-hand root cause is addressed for the `fromPlaying` full-flow path.

VERDICT: PASS
