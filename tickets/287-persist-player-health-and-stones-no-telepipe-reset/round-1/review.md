# Final Review — 287-persist-player-health-and-stones-no-telepipe-reset

## Runtime health — FAIL (no green capture)

The dev servers started cleanly (`server.log`: "Server listening on port 3003"; `client.log`: Vite ready on 5176) and the browser loaded with **no page errors** (`pageerrors.json` is `[]`, no `pageerror`/`[fatal]` lines in `console.log`). There is **no `harness_failure` block** — this is not a port/infra start failure.

However `metrics.json` has `"ok": false` with `"failure_kind": "capture_failed"`, and `console.log` ends with:

`[capture:error] Telepipe run-preservation assertion failed: suspended objective was not captured before assertRunPreserved`

Per the review rules, an `ok: false` captured run is an automatic failure: we have no green runtime proof. So the verdict is FAIL.

**Root cause is the harness capture recipe, not the game code.** The capture ran the *fallback* recipe (`capturePlanSource: "fallback"`) in `harness/screenshot.mjs`. That recipe is hard-coded for the OLD checkpoint world:
- the suspended-lobby probe stashes the objective from `data.harnessState.suspendedRunSummary.objective` (`harness/screenshot.mjs:358`, read at `:980`);
- `assertRunPreserved` then fails when that stash is null (`:1055-1056`).

This ticket *intentionally removed* `suspendedRunSummary` (sub-ticket 03; `game/server/test/server.test.js:4881` asserts the snapshot no longer has it). So the stale recipe reads `undefined` and throws. The live objective is still present in the harness state (the PRE-SUSPEND probe in `screenshot.log` shows `objective: { type:'defeat_enemies', totalEnemies:5, defeatedEnemies:0 }`), so the recipe simply needs to read it from `harnessState.objective` instead of the removed `suspendedRunSummary`. **The next round must fix the harness recipe — it must NOT re-add `suspendedRunSummary` to game code, which would revert the ticket.**

## Acceptance criteria

### AC1 — Telepipe-up → return to hub → redeploy preserves Magic Stones and partial health
**Met (code + tests).** `suspendRunToLobby()` (`progression.js:2626`) keeps `hp` and `magicStones` (only recomputes `dead` from `hp`); `resumeSuspendedRunInPlace()` (`:2592`) does not touch them either. There is no magic-stone reset on deploy (sub-ticket 01). Covered by `server.test.js:3039` ("solo telepipe extract and redeploy preserves run id, layout seed, hp, and magic stones" — asserts `hp === damagedHp` and `magicStones ≈ spent`) and `integration.test.js:5336` (two-player suspend→resume).

### AC2 — Visiting the med booth restores health
**Met (code + tests).** `healAtMedic()` (`progression.js:456`) charges `MEDIC_HEAL_COST`, sets `hp = MAX_HP`, clears `dead`, and persists. Crucially, the lobby no longer auto-heals: `revivePlayerInLobby()` (`:446`) only recomputes `dead` from `hp` and leaves partial HP intact. Covered by `server.test.js:3013` ("healAtMedic restores partial HP after telepipe hub return; without medic HP stays partial") and the `healAtMedic()` describe block at `:3339`.

### AC3 — No fresh-run-on-redeploy; runId / state continuity preserved
**Met (code + tests).** `checkAllReadyInner()` (`progression.js:3052`) routes a suspended run through `resumeSuspendedRunInPlace()` rather than `startDungeonRun()`, preserving `run.id`, `layoutSeed`, the live enemy set, telepipe, and objective progress. Asserted in `server.test.js:3039` (`run.id`/`layoutSeed` unchanged) and `integration.test.js:5336` (`resumed.run.id === state.run.id`).

### AC4 — Server tests: telepipe-up → redeploy preserves health + magic stones; med booth heals
**Met.** The vitest suite passed (coverage.log: 91 files / 1507 tests passed). The specific cases above exist and pass. The old checkpoint suspend/resume machinery was removed and replaced by the in-memory pause; `captureRunCheckpoint`/`restoreRunCheckpoint`/`suspendedCheckpoint` are gone.

## Design & debug-scenario review
- The `telepipe-ready` debug scenario (`?debugScenario=telepipe-ready`) is gated through the debug path (`applyTelepipeReadyHand` only fires when `player.debugScenario === 'telepipe-ready'` at deploy, `progression.js:3066`). It only pre-stocks a telepipe + tops HP/MS; the same end-state is reachable by normal play (deploy, acquire/place a telepipe, enter the portal). It does not bypass the suspend/resume server path the probe exercises. No regression.
- `game/docs/design.md:33-35` still describes the removed *checkpoint capture/restore* model. The code now uses an in-memory pause, so the doc is stale (nit, not blocking).

## Remaining gaps
1. **No green capture.** `metrics.json` `"ok": false`; the fallback telepipe capture recipe in `harness/screenshot.mjs` still asserts the removed `suspendedRunSummary` checkpoint contract, so `assertRunPreserved` throws. This must be updated to the new in-memory contract (and re-captured) — without reverting the game-side removal. See `gaps.md`.

(The acceptance criteria themselves are fully met and unit-tested; the only blocker is the stale harness capture recipe producing the non-green run.)

VERDICT: FAIL
