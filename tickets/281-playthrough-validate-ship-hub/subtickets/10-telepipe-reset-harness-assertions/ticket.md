# Telepipe-reset harness assertions (abandon path, not resume)

`runTelepipeResetStep` depletes MS/charges and calls `abandonSuspendedRun`, but `telepipeUpReset` omits proof the **abandon+fresh-deploy** path ran (resume also resets MS on a new hand deal). Add server-log and `runId` guards; do **not** require `layoutSeed` inequality — quest layout seeds are deterministic per quest and match on both resume and fresh deploy.

## Acceptance Criteria

- `harness/validate/lib/telepipe.mjs`:
  - `probeHandAndMs()` records `runId` from harness state.
  - After second `deployViaLaunchBooth`, assert `postDeploy.runId !== preSuspend.runId` (fresh `createRunState`, not checkpoint restore); throw with both ids if equal.
  - Capture server log tail during the step and assert the telepipe-reset slice does **not** contain `[run] checkpoint restored` between suspend and post-deploy screenshot.
  - `telepipeUpReset` is true only when depletion probes, fresh-deploy MS/charge probes, **runId changed**, and no forbidden log line — never when resume path ran.
  - `abandonSuspendedRun()` falls back to `window.__abandonSuspendedRunForTest()` when DOM click is flaky.
- `harness/validate/verify-hub-artifacts.mjs` (full-run check): when `telepipeReset.preSuspend.runId` and `postDeploy.runId` are present, fail verification if they are equal while `assertions.telepipeUpReset === true`.
- `harness/validate/lib/findingsHub.mjs` `telepipeDetail()` mentions run-id change and absence of `checkpoint restored` (not layout seed).
- Add or restore server unit test `fresh deploy after telepipe suspend and abandon resets magicStones and card charges` in `game/server/test/server.test.js` asserting new `run.id` after abandon → `checkAllReady()` (minimal server test edit allowed).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- Edit: `harness/validate/lib/telepipe.mjs` — `readServerLogForbidden(substr)`, extend `probesMatchFreshDeploy` or add `probesMatchFreshRunId(pre, post)`; update `runTelepipeResetStep` return object with `freshRunIdConfirmed: true` and `checkpointRestoredInLog: false`.
- Edit: `harness/validate/verify-hub-artifacts.mjs` — runId sanity check on `telepipeReset` probes.
- Edit: `harness/validate/lib/findingsHub.mjs` — telepipe failure strings.
- Edit (minimal): `game/server/test/server.test.js` — abandon → fresh deploy integration test using `checkAllReady()` and comparing `gameState.run.id`.
- Reuse: `STARTING_MAGIC_STONES`, `probesMatchDepletion`, `probesMatchFreshDeploy` in `telepipe.mjs`.
- Depends on sub-tickets **08** and **09**.

## Verification: code
