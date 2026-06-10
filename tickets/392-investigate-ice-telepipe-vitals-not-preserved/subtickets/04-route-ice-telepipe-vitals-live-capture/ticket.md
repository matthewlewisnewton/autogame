# Route the ICE telepipe-vitals live capture to frost-telepipe-ready

Make the harness live persist-vitals telepipe capture exercise the **ICE level**
for this ticket: select the new `frost-telepipe-ready` scenario (from sub-ticket
03) instead of the generic `telepipe-ready`, and re-emit it in the suspended
lobby so the redeploy is a fresh sortie. This is what makes the top-level review's
`assertVitalsPreserved` (HP exact carry-forward, MS preserved, fresh runId) pass
on `frost_crossing` instead of failing on `training_caverns`.

## Background / what we know

- The top-level review proof is `buildSoloTelepipeVitalsPreservationSteps` in
  `harness/screenshot.mjs` (this ticket matches `PERSIST_VITALS_TELEPIPE_RE`).
- That capture hardcodes `emitScenario 'telepipe-ready'`
  (`buildSoloTelepipeSuspendThroughProbeSteps`, ~line 464) and never re-emits it,
  so redeploy RESUMES the suspended checkpoint: same runId, player back in live
  combat -> the round-1 failure `HP 80 -> 40` and `runId must differ ... unchanged`.
- Sub-ticket 03 adds `frost-telepipe-ready`, which (on a re-emit while a checkpoint
  is suspended) abandons the checkpoint -> fresh sortie / new runId with lobby
  vitals carried forward, and lands on `frost_crossing` / ice-cavern. The capture
  must (a) use that scenario and (b) re-emit it before the redeploy `readyAll`.
- Adding ticket-specific capture routing to `harness/screenshot.mjs` is the
  established pattern here (see the 281 / 287 / 305 routing regexes).

## Acceptance Criteria

- An ICE-detection predicate (e.g. `ICE_PERSIST_VITALS_RE` matching
  `frost[_-]?crossing` / `ice[- ]?cavern` / `ice[- ]?telepipe` / `frost[- ]?telepipe`
  against the ticket text or output dir) routes this ticket's persist-vitals
  capture to the ice path. Non-ice persist-vitals tickets are unaffected.
- `buildSoloTelepipeSuspendThroughProbeSteps` and
  `buildSoloTelepipeVitalsPreservationSteps` take a telepipe-scenario-name
  parameter that defaults to `'telepipe-ready'`; the `emitScenario` step uses it.
- For the ICE persist-vitals path the capture uses `'frost-telepipe-ready'`, so the
  run deploys on `frost_crossing` / ice-cavern (verifiable in `server.log` as a
  `frost_crossing` layout instead of `training_caverns`).
- For the ICE (fresh-sortie) path only, `buildSoloTelepipeVitalsPreservationSteps`
  RE-EMITS the frost scenario while in the suspended lobby — after the
  `02-suspended-lobby` probe and before the redeploy `readyAll` — so
  `abandonSuspendedRun` fires and the redeploy is a fresh sortie (new runId) with
  HP/MS carried forward. The generic `telepipe-ready` path keeps its current
  single-emit behavior (no re-emit).
- The suspend/resume capture (`isTelepipeTicket` branch, `assertRunPreserved`) and
  all non-ice persist-vitals captures are byte-for-byte unchanged in behavior.
- The `capturePlanSummary` string for the ICE path names the frost / ice
  scenario so the evidence is self-describing.

## Technical Specs

- **`harness/screenshot.mjs`** — only file changed.
  - Add the ICE-detection regex/predicate near the existing
    `PERSIST_VITALS_TELEPIPE_RE` / `isPersistVitalsTelepipeTicket` (~lines 285, 320).
  - Parameterize `buildSoloTelepipeSuspendThroughProbeSteps` (~line 450) and
    `buildSoloTelepipeVitalsPreservationSteps` (~line 513) with a `telepipeScenario`
    argument; thread it into the `emitScenario` step (~line 464).
  - In the `isPersistVitalsTelepipe` capture branch (~line 712), when the ICE
    predicate is true, pass `'frost-telepipe-ready'` and enable the suspended-lobby
    re-emit; otherwise keep the existing generic behavior.
  - Insert the re-emit `{ action: 'emitScenario', scenario: 'frost-telepipe-ready' }`
    (plus a short `wait`) only on the ICE/fresh-sortie path, between the
    `02-suspended-lobby` probe and the appended `readyAll`.
- Do NOT change `game/` here; the `frost-telepipe-ready` scenario and its
  server-side carry-forward come from sub-ticket 03.

## Verification: code
