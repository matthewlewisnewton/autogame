# Unblock the local-checks gate so the telepipe suspend→resume live capture completes the round trip

The client wiring that turns the suspended-hub `#ready-btn` into a Resume control is ALREADY
DONE and reviewer-verified in the working tree (`game/client/main.js`, `game/client/style.css`
— retired sub-ticket 03's AC1–6). The ONLY remaining gap for the top-level ticket is its
required end-to-end proof: the live harness telepipe capture must suspend the run and then
resume it, preserving state. That capture never runs because local-checks hard-fail on ONE
flaky server test (`field_medic_kit.test.js:167`), and on a local-checks failure the capture
is skipped — so the round-trip proof gets zero evidence. This sub-ticket makes the one
in-scope test fix that unblocks the gate, then relies on the (unmodified) harness capture
recipe to produce the proof.

## Acceptance Criteria

- The flaky magic-stones assertion at `game/server/test/field_medic_kit.test.js:167` no longer
  fails under load: its `toBeCloseTo(p3MsBefore, …)` precision is widened to match its sibling
  magic-stones assertions (lines 131/132/256 use precision `1`), so a fractional MS-regen tick
  during the test no longer trips it. No production code and no other test logic changes.
- Local-checks pass cleanly: `local-checks.status.json` is `rc:0` and the server vitest suite
  reports 0 failures (the `field_medic_kit` flake is gone). This is what re-enables the capture.
- The already-present Resume client wiring remains intact (no regression to retired sub-ticket
  03's verified behavior): while the run is suspended (`isRunSuspended()`), `#ready-btn` is
  visible+enabled, labeled `THEME.run.resumeSortie` / `THEME.run.resumeReady`, carries the
  `.resuming` style, and `#resume-run-btn` is hidden; when NOT suspended, `#ready-btn` shows
  `THEME.lobby.deploy` / `deployReady` with no `.resuming` class. (Verify by reading the diff —
  these files should be unchanged this pass beyond what's already committed/in the tree.)
- The live harness telepipe capture completes the full suspend→hub→resume round trip:
  `metrics.json` is `ok:true` with the preservation block intact; `console.log` shows the run
  suspend AND a subsequent resume (`[run] checkpoint restored` / a resumed `waitForGame` that
  no longer times out); a resumed-dungeon screenshot is produced; and the preservation probe
  confirms magic stones, card `remainingCharges`, and objective progress are PRESERVED across
  the round trip (not reset to STARTING).

## Technical Specs

- `game/server/test/field_medic_kit.test.js` (line ~167): change
  `expect(playerForSocket(players[2].socket).magicStones).toBeCloseTo(p3MsBefore, 2);`
  to use precision `1` (i.e. `toBeCloseTo(p3MsBefore, 1)`), matching the sibling magic-stones
  assertions at lines 131, 132, and 256. The in-line comment already notes "MS may tick regen
  by a fraction" — this aligns the tolerance with that reality. Do NOT change `progression.js`
  or any production MS-regen logic; the test is the defect.
- `game/client/main.js` and `game/client/style.css`: these already contain the verified Resume
  wiring (`setDeployButtonVisible()` / `renderSuspendedRunBanner()` ~507-548, the `lobbyUpdate`
  handler ~1478-1496, the `#ready-btn` click handler ~3811-3824, and the `#ready-btn.resuming`
  CSS ~917-928). They are listed here only so the accumulated, already-reviewed diff stays
  in-scope — do NOT rewrite them; altering correct code risks regressing the verified ACs.
- Do NOT modify `harness/` — the telepipe capture recipe (`harness/screenshot.mjs` `readyAll`
  → clicks the now-visible `#ready-btn` → `waitForGame`) is fixed and already drives the
  resume path once local-checks pass. Do NOT change the server extraction/suspend/restore
  logic (`captureRunCheckpoint` / `restoreRunCheckpoint` / the `checkAllReady` resume gate);
  state preservation is already locked by sub-ticket 02's integration test.
- The capture round-trip is the deliverable proof. If a capture run reports a transient infra
  failure (e.g. `metrics.json` `{"ok":false,"error":"servers did not start"}`) rather than a
  code/test defect, that is an orchestration/load issue, not a code change — the fix above is
  the only code change this sub-ticket requires.

## Verification: code
