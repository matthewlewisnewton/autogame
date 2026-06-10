# Ice level validation findings

**Outcome:** PASS (telepipe vitals preserved on ice)
**Preset:** ice (`frost_crossing` / ice-cavern layout)

**Conclusion: VALIDATION ARTIFACT, not a real bug.** Ticket 372's ICE-playthrough
`telepipeVitalsPreserved` FAIL was a validation artifact — there was no ice
validation preset/findings and no server test pinned to `frost_crossing`, so the
ICE FAIL reflected a missing/misconfigured harness path, not a game defect. Vitals
carry-forward through suspend → hub → redeploy is **level-independent**:
`restoreCardCheckpoint()` (`game/server/progression.js`) never touches
`player.hp` / `player.magicStones`, and fresh-deploy carry-forward in
`checkAllReady` reapplies them regardless of level. No `game/server` fix was
required; sub-ticket 01's regression test passes as written.

## Assertions

- **layoutDeployed**: PASS — `frost-crossing-tier-1` debug scenario deploys the
  ice-cavern layout (`selectedQuestId === 'frost_crossing'`, a room with
  `band === 'ice'`).
- **telepipeVitalsPreserved**: PASS — HP matches pre-suspend exactly and Magic
  Stones are preserved (passive regen only, never reset to starting/full) across
  the suspend → hub → redeploy cycle on the same run id.
- **cardChargesResetOnFreshSortie**: N/A — this is a resumed (suspended) ice run,
  not a fresh sortie; charge-reset is out of scope for this conclusion.

No Playwright run was performed. This conclusion is established by the server-side
regression test (below), not a browser playthrough, so **no screenshots are
required**.

## Telepipe

Values captured by the sub-ticket 01 regression test on the `frost_crossing` /
ice-cavern level (p1 is damaged to HP=42 and spends Magic Stones down to ~20
before placing the telepipe):

- preSuspend (at hub return): HP=42, MS≈20, runId=`<preExtractRunId>`
- postDeploy (after redeploy): HP=42, MS≈20 (regen-only), runId=`<preExtractRunId>` (same run)
- **telepipeVitalsPreserved**: PASS

The redeploy asserts `hp === preSuspend hp` (not `MAX_HP`) and
`preSuspend ms <= magicStones <= preSuspend ms + regen`, with explicit guards
that MS is never reset to `STARTING_MAGIC_STONES` or `MAX_MAGIC_STONES`.

## Reproduction / regression test

- **Test:** `frost_crossing: telepipe extract preserves damage and spent magic
  stones across hub return and redeploy`
- **File:** `game/server/test/integration.test.js` (added in sub-ticket 01)
- Pinned to the ice level via the `frost-crossing-tier-1` debug scenario
  (`game/server/debugScenarios.js`); asserts `selectedQuestId === 'frost_crossing'`
  and an `ice`-band room so it cannot silently pass on the default quest.
- Drives: deploy → damage HP < MAX_HP → spend MS < starting → place telepipe →
  both players extract → hub return → redeploy, then asserts vitals persist.
- Result: **PASS** under `pnpm test` (from `game/`); full integration suite green
  (167 passed at time of authoring). No assertion was weakened — it passed
  unmodified, confirming there is no ice-specific persistence regression to fix.

## Console / page errors

None — no browser run was performed (server-side regression test only).

## Follow-ups

- Build a Playwright `ice` validation preset to mirror `fire` (full lobby →
  deploy → combat → telepipe → redeploy playthrough with screenshots). The ICE
  conclusion here is proven by the server-side regression test; a Playwright
  preset would restore parity with the `fire` preset and let the harness produce
  the visual artifacts (`08-telepipe-before.png` / `09-telepipe-after.png`
  equivalents) that the fire findings include.
