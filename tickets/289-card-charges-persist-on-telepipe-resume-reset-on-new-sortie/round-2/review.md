# Final Review

## Runtime health

FAIL. The captured run is not clean: `round-2/metrics.json` has `"ok": false` with `failure_kind: "capture_failed"`. The servers did start and `pageerrors.json` is empty, but the browser capture failed its ticket-specific assertion:

> Telepipe run-preservation assertion failed: suspended objective was not captured before assertRunPreserved

`console.log` contains the same `[capture:error]`. This is not a `harness_failure` infrastructure block and not a browser pageerror; it is a failed live browser proof for the suspended/resume flow. The suspended lobby probe shows `objective: null`, `runStatus: null`, and no exposed `suspendedRunSummary`, even though the server snapshot path has one.

## Acceptance criteria

- **Telepipe resume preserves card charges:** Partially implemented server-side. `game/server/progression.js` captures and restores per-player `hand`, `deck`, `inDesperation`, `nextDrawAt`, and `desperationDeck`, and the server tests cover remaining-charge preservation on resume. However, the live browser capture failed before it could pass the preserved-run assertion because the client does not expose or render the suspended checkpoint summary. This criterion is not robustly proven in the running game.

- **New sortie resets card charges:** Not fully met through normal browser gameplay. The server supports `abandonRun` and tests raw socket emission to clear `suspendedCheckpoint`, then redeploy with fresh charges and a new run id. The actual client has hidden `#resume-run-btn` / `#abandon-run-btn` elements but no `runSuspended` handler, no `suspendedRunSummary` handling, and no button wiring that emits `CLIENT_TO_SERVER.ABANDON_RUN`. A player in the browser can ready-up to resume, but there is no normal visible path to abandon the suspended checkpoint and start a fresh sortie.

- **Health and magic stones persist in both cases:** Server-side behavior is covered and appears correct. Fresh deploy preserves existing finite `hp` and `magicStones`; resume restores card state without resetting vitals; abandon/new-sortie tests preserve non-default vitals.

- **Server tests covering both paths:** Present and passing in `coverage.log` (`90` test files, `1366` tests). Coverage includes telepipe resume preserving cards/vitals and abandon/new-sortie resetting card charges while preserving vitals. The missing coverage is browser/client integration around suspended-run UI and the normal abandon path.

## Design and requirements

The foundation requirements are not obviously regressed: the app starts servers, connects, and renders enough for the capture to drive the dungeon flow.

`game/docs/design.md` is now inconsistent with the implemented ticket behavior. It still says telepipe has no checkpoint/resume path, redeploy always starts a fresh dungeon, and card charge persistence is out of scope. The ticket explicitly changes that policy, so the design doc needs to be updated alongside the implementation.

## Debug scenario

`?debugScenario=telepipe-ready` is gated through the debug-scenario URL path and server debug permissions, and it does not directly suspend or resume the run. It sets up a player for the normal ready-up path, where `checkAllReady()` injects Telepipe and normal server telepipe validation performs extraction/suspend. The equivalent state is reachable through normal play by acquiring Telepipe and deploying with it in the deck. The debug shortcut itself is not the blocking issue.

## Remaining gaps

1. The live browser capture fails with `metrics.json` `"ok": false` because the suspended objective/checkpoint summary is not captured or exposed in the client state used by QA.

2. The browser has no normal UI path to abandon a suspended telepipe checkpoint and start a fresh sortie, so the new-sortie card reset path is only proven through raw socket tests.

3. `game/docs/design.md` still documents the pre-ticket telepipe policy and contradicts the new checkpoint/resume behavior.

VERDICT: FAIL
