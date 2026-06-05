## Per-Criterion Findings

### Runtime Health

Fail. The required captured run did not complete cleanly. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and `console.log` ends with `page.waitForFunction: Timeout 12000ms exceeded.` There are no browser page errors (`pageerrors.json` is empty) and the server did start, but the instructions make any `ok:false` capture an automatic fail.

The partial capture proves only the first half of the flow: the game loaded, the `telepipe-ready` debug scenario applied, a Telepipe was placed, the solo player extracted, and the server captured/suspended the run (`[run] checkpoint captured`, `[run] suspended: Initiate Vault`). It does not prove resume: there is no resumed-dungeon screenshot/probe and no `[run] checkpoint restored` log in the capture artifacts.

### Acceptance Criterion: Telepipe Up -> Walkable Hub; Resume Re-Enters Suspended Run With State Preserved

Partially satisfied in code and unit/integration tests, but not proven by the required live capture.

The client now swaps extracted and lobby states back to the hub layout instead of leaving the player on dungeon geometry, and it adds a distinct `Resume sortie` button while hiding the regular `Deploy` button when `suspendedRunSummary` is present. Server-side resume still goes through the ready gate, but `checkAllReady()` correctly restores `suspendedCheckpoint` before the fresh-run path.

The server integration coverage is strong for the preservation requirement: the added `Telepipe suspend and resume` test verifies magic stones stay below the starting value, a damaged weapon card keeps its `remainingCharges`, objective progress survives, portal/enemy state is restored, and players are no longer marked extracted after resume. However, the live capture timed out immediately after the suspended hub state, so the top-level acceptance criterion is not fully verified end-to-end.

### Design And Requirements Consistency

The implementation is consistent with `game/docs/design.md`: Telepipe remains a mid-run evacuation spell, the run suspends only after all active players extract, and resume restores the checkpoint rather than generating a new layout. It does not appear to regress the foundation requirements: the captured run reached a rendered Three.js scene, connected to the backend via Socket.IO, showed the player state, and the vitest suite passed.

### Debug Scenarios

This ticket added `extracted-in-hub` and `suspended-run-hub`, and reused `telepipe-ready` in the capture. They are gated through the existing `debugScenario` socket path, which is restricted to local/dev access or `ALLOW_DEBUG_SCENARIOS=1`; normal gameplay does not enter these states. The scenario comments and server tests show equivalent normal paths exist: partial multiplayer Telepipe extraction for `extracted-in-hub`, and deploy/place Telepipe/extract all squadmates for `suspended-run-hub`. The shortcuts mutate server state directly for QA setup but do not bypass the real resume invariant because the actual resume still runs through `playerReady` -> `checkAllReady()` -> `restoreRunCheckpoint()`.

### Tests And Coverage

`coverage.log` shows the vitest run passed: 51 test files and 1169 tests. Relevant additions include `server/test/debug-scenarios.test.js` coverage for `suspended-run-hub` and `server/test/integration.test.js` coverage for the Telepipe preservation round trip. Coverage thresholds were disabled, and the visible warnings are existing benign model-load/test-environment noise.

## Remaining gaps

1. The live capture does not prove the complete suspend-to-hub-to-resume flow. `metrics.json` is `ok:false` with `failure_kind: "capture_failed"`, and the capture stops after `[run] suspended: Initiate Vault` with `page.waitForFunction: Timeout 12000ms exceeded`; there is no resumed-dungeon proof or checkpoint-restored log.

VERDICT: FAIL
