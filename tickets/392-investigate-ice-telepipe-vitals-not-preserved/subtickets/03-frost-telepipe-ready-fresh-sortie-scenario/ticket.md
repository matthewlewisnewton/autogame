# Frost (ice) telepipe-ready fresh-sortie debug scenario

Add a `frost-telepipe-ready` debug scenario that mirrors the proven
`fire-telepipe-ready` path but lands on the **ice level** (`frost_crossing` /
ice-cavern) and drives a **fresh-sortie** telepipe redeploy: on redeploy from a
suspended checkpoint it abandons the checkpoint and carries the player's lobby
vitals (HP + Magic Stones) forward into a brand-new run. This is the server-side
enabler the live ICE telepipe-vitals capture needs (sub-ticket 04 routes the
capture to it).

## Background / what we know

- The top-level review proof is the live persist-vitals capture, which asserts
  HP-exact carry-forward, MS preserved, AND a **fresh runId** after redeploy.
- Generic `telepipe-ready` (`game/server/debugScenarios.js:508`) does NOT abandon
  the suspended checkpoint, so redeploy RESUMES the same run (same runId, player
  back in live combat) — which is why the round-1 capture failed `HP 80 -> 40`
  and `runId unchanged`. Changing `telepipe-ready` globally would break the
  suspend/resume capture other tickets rely on, so ICE needs its own scenario.
- `fire-telepipe-ready` (`game/server/debugScenarios.js:514`) already implements
  the correct fresh-sortie semantics: on redeploy it calls `abandonSuspendedRun`,
  sets `_telepipeFreshSortie`/`_msRegenGraceUntil`, keeps lobby vitals, and lets
  `checkAllReady` carry HP/MS forward into a fresh run id. Mirror it for ice.

## Acceptance Criteria

- A new `frost-telepipe-ready` debug scenario exists in
  `game/server/debugScenarios.js` and is registered in the `DEBUG_SCENARIOS` set,
  with a comment noting it is a shortcut into a normally-reachable
  `frost_crossing` telepipe state.
- **First emit (no `state.suspendedCheckpoint`)**: selects `frost_crossing`
  tier 1, applies the ice-cavern layout, sets `player.ready = false`, sets partial
  lobby vitals (so MS regen cannot overshoot starting MS), and emits the lobby
  quest update — mirroring `fire-telepipe-ready`'s non-checkpoint branch but for
  `frost_crossing`.
- **Redeploy emit (`state.suspendedCheckpoint` present)**: calls
  `abandonSuspendedRun(state)`, sets `player._telepipeFreshSortie = true` and an
  `_msRegenGraceUntil` grace window, and does NOT reset the lobby vitals — so the
  subsequent `readyAll` deploy is a FRESH sortie (new run id) carrying the lobby
  HP/MS forward.
- The telepipe card is injected into hand **slot 0** on deploy (use the default
  `applyTelepipeReadyHand` placement, NOT `fire-telepipe-ready`'s slot-1 layout)
  so the shared solo capture's "place telepipe via hand key `1`" works unchanged.
- `game/server/progression.js` recognizes `'frost-telepipe-ready'` everywhere it
  currently special-cases the telepipe scenarios: `applyTelepipeReadyHand`
  (~line 1067 — frost falls through to the default slot-0 telepipe placement),
  and `checkAllReady` (~lines 3704, 3719) for telepipe-hand injection and HP/MS
  carry-forward. Do NOT spawn the `fire-telepipe-ready` dummy enemy (~line 3727)
  for the frost scenario — the redeploy must spawn the player cleanly so vitals
  stay stable through the assertion window.
- A new server integration test in `game/server/test/integration.test.js` drives:
  emit `frost-telepipe-ready` -> deploy (telepipe in slot 0) -> place telepipe ->
  solo extract so the run suspends -> re-emit `frost-telepipe-ready` in the
  suspended lobby -> `readyAll` redeploy. It asserts: the run lands on
  `frost_crossing` / ice-cavern; HP after redeploy **equals** the pre-suspend HP;
  MS after redeploy is preserved (>= pre-suspend, within regen tolerance, not
  reset to starting/full); and the run id after redeploy **DIFFERS** from the
  pre-suspend run id (fresh sortie).
- `pnpm test` (from `game/`) passes, including the new test, with no regression in
  existing telepipe / fire-telepipe / vitals tests.

## Technical Specs

- **`game/server/debugScenarios.js`** — add the `if (name === 'frost-telepipe-ready')`
  block immediately after the `fire-telepipe-ready` block (~line 541), structured
  identically but using `state.selectedQuestId = 'frost_crossing'` /
  `applyLayoutForQuest(state, 'frost_crossing', 1)` (see the existing
  `setupFrostCrossingTier1Deploy` helper at line 259 and `frost-crossing-tier-1`
  at line 1237 for the ice quest id and layout helpers). Register the name in the
  `DEBUG_SCENARIOS` set.
- **`game/server/progression.js`** — extend the existing scenario-name checks at
  ~lines 1067 (`applyTelepipeReadyHand`), 3704 and 3719 (`checkAllReady`
  deploy/carry-forward) to include `'frost-telepipe-ready'`. Leave the
  fire-only dummy-enemy spawn (~3727) gated to `fire-telepipe-ready` only.
- **`game/server/test/integration.test.js`** — add the new fresh-sortie test,
  reusing the existing telepipe helpers (`connectAndJoinLobby`, `tryEnterTelepipe`,
  `testGameState`, the `debugScenario` socket emit). Model it on the existing
  telepipe vitals test (~line 5531) but assert a **differing** run id after
  redeploy (fresh sortie), not a matching one.
- Do NOT edit `harness/` here — capture routing is sub-ticket 04.

## Verification: code
