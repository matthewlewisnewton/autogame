# Review

## Runtime health
The captured run is not clean. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`. The dev servers did start, `pageerrors` is empty, and the console has no uncaught page error or fatal game-code error, so this is not a browser pageerror or harness startup blocker.

The failure is a gameplay-state assertion after a successful telepipe suspend/resume flow:

`Telepipe run-preservation assertion failed: pre-suspend enemy id(s) missing after resume ... restore conjured non-spawner enemy id(s) ... suspended objective was not captured before assertRunPreserved`

That makes the ticket an automatic fail under the runtime-health rule.

## Telepipe resume preserves card charges in the same run
Blocking gap. The implementation preserves some card-state metadata, but it does not robustly resume the same in-progress run. `captureCardCheckpoint()` records run metadata and per-player hand/deck state, then `suspendRunToLobby()` clears transient world state. On resume, `restoreCardCheckpoint()` restores the saved run object and card state but immediately calls `spawnEnemies()`, creating a fresh enemy population rather than restoring the pre-suspend one.

The captured probes show the mismatch clearly: the pre-suspend enemy set had five ids, the resumed run had five different ids, and `preservedIds` was `0`. The run id and layout seed remained the same, but the live enemy/objective state did not. That is not a robust "same run" resume.

## New sortie resets card charges
Mostly satisfied server-side, but not enough to pass while the resume path is broken. The new `abandonSuspendedRun()` path clears the checkpoint, starts a new run id on the next deploy, and the server/integration tests assert hand cards return with full charges while hp and magic stones persist.

## Health and magic stones persist in both paths
Satisfied by the covered server paths and by the captured probes available before the assertion failure. The implementation keeps hp and magic stones on the player object through suspend, resume, and abandon/new-sortie deploy instead of resetting them to max/default values.

## Server tests
The recorded coverage run passed: `90` test files and `1364` tests. The new tests cover card charges, new-sortie reset, and hp/magic-stone persistence.

However, the tests miss the captured failure. One integration test is still named as a fresh-dungeon redeploy case and explicitly asserts the injected pre-suspend enemy id is absent after "resume", which codifies the respawn behavior that the live capture rejects. Add test coverage that verifies resumed runs keep existing enemies, objective progress, and other live world state.

## Design and requirements
The basic foundation requirements are not regressed: the server and client started, connected, rendered, and exchanged state before the assertion failure.

The ticket intentionally supersedes the current Telepipe section in `game/docs/design.md`, which still says there is no checkpoint/resume path and that card-charge persistence is out of scope. I treated that as a documentation nit because the owner decision in this ticket is newer, but the docs should be updated after the code behavior is corrected.

## Debug scenarios
The capture used `?debugScenario=telepipe-ready`. The scenario is gated behind the localhost debug URL/event path, normal gameplay does not call it, and the server still routes deploy through the normal ready-up path before injecting the telepipe-ready hand. The same end state is reachable through normal play by bringing a Telepipe card into a sortie and placing it; the scenario is a QA shortcut, not the implementation path for suspend/resume itself.

## Remaining gaps
1. Telepipe resume recreates live world state instead of restoring the suspended run. The resumed run keeps the old run id but respawns enemies with new ids and loses the pre-suspend enemy/objective continuity, causing the captured game run to fail. Fix the checkpoint/resume model to preserve the full in-progress run state, and add tests that fail if enemies/objective state are regenerated on resume.

VERDICT: FAIL
