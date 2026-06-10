## Runtime health

**FAIL.** The captured run is not clean: `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`. This is not a harness startup failure and not a browser page error: the server and Vite client both started, `pageerrors` is empty, and `console.log` contains no `[fatal]` or `pageerror` lines. The failure is the scenario assertion itself:

`Telepipe vitals-preservation assertion failed: HP mismatch across telepipe redeploy: 80 -> 40; magic stones mismatch across telepipe redeploy: 99 -> 99; runId must differ after fresh redeploy: pre=b25a08c9-2d71-4a5d-b84a-442e5dbe65d7 post=b25a08c9-2d71-4a5d-b84a-442e5dbe65d7`

The probes show the run reached playable dungeon, telepipe extraction, hub suspension, and redeploy. The server log confirms `[run] checkpoint captured` followed by `[run] checkpoint restored`, so the capture is exercising the suspended-run resume path and failing the ticket's required proof.

## Acceptance criteria findings

**Investigate whether the ICE telepipe vitals failure is real or a validation artifact:** Partially met in unit/integration coverage, but not robustly proven for the whole ticket. The added `game/server/test/integration.test.js` case pins `frost_crossing`, damages HP, spends Magic Stones, telepipe-suspends, resumes, and asserts HP/MS preservation on the same run id. That test passed in `coverage.log` as part of `167 passed`.

The live capture does not validate the stated ICE path, though. Its capture summary uses the generic `telepipe-ready` scenario, and the probe layout is `training_caverns` / `Initiate Vault`, not `frost_crossing`. Since the top-level ticket is specifically about ICE / `frost_crossing`, the browser proof does not match the ticket scope.

**Fix if real:** Not satisfied at whole-ticket level. No production game code changed in this ticket; the implementation only added a server integration test and `game/validation/ice/findings.md`. The live capture still fails the telepipe vitals proof, so the ticket cannot be accepted as fully resolved.

**Add or adjust a test:** Met for server-side regression coverage. The new integration test is meaningful and verifies the ice-level suspended-run path. It does not replace the required passing live capture.

**Design and requirements consistency:** The production telepipe lifecycle is consistent with `game/docs/design.md`: telepipe extraction suspends the current run, and redeploy resumes the same run id unless the player chooses `Abort Sortie`. The capture expectation that the run id must differ is only valid for a fresh sortie after abandoning the checkpoint, not for a normal telepipe resume. The implementation needs a coherent ICE validation path that either proves normal resume semantics or explicitly abandons the suspended run before asserting a fresh run id.

**Debug scenarios:** This ticket did not add a new debug scenario. It relies on existing scenarios. `frost-crossing-tier-1` is gated behind the debug scenario socket path and represents a normally reachable state, but it is only used by the server test. The live capture uses `telepipe-ready`, which is also debug-gated but does not select the ice quest and does not handle the fresh-sortie branch the way `fire-telepipe-ready` does.

## Remaining gaps

1. The captured game run failed the ticket's telepipe vitals assertion, so the whole-ticket runtime proof is failing even though the game loads without page errors.
2. The live validation path does not exercise the ICE / `frost_crossing` scenario required by the ticket; it uses `training_caverns` via generic `telepipe-ready`.
3. The capture's fresh-run-id expectation conflicts with the design path it actually drives: redeploy from a suspended telepipe checkpoint resumes the same run id unless the checkpoint is abandoned first.

VERDICT: FAIL
