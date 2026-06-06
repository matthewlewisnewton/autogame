# Screenshot harness: telepipe capture uses in-memory pause contract

The fallback telepipe suspend→resume capture recipe in `harness/screenshot.mjs` still stashes the objective from the removed `suspendedRunSummary` checkpoint field, so `assertRunPreserved` always throws and `metrics.json` stays `"ok": false`. Update the recipe to the new in-memory pause model: read the live objective from `harnessState.objective`, and assert run continuity (same `runId`, `runStatus` suspended→playing) alongside the existing enemy-set preservation checks. Do **not** re-add `suspendedRunSummary` to game code.

## Acceptance Criteria

- `stashObjective` probe handler reads `data.harnessState.objective` (not `suspendedRunSummary.objective`); a suspended-lobby probe after solo telepipe-up stashes a non-null objective with `type`, `totalEnemies`, and `defeatedEnemies`.
- `assertRunPreserved` no longer fails with `suspended objective was not captured before assertRunPreserved`; the `preservation` probe block includes a non-null `objective` echo matching the pre-suspend enemy count.
- `assertRunPreserved` verifies run continuity: stashed `runId` from the suspended probe matches the resumed probe's `harnessState.runId`, and resumed `runStatus === "playing"` (was `"suspended"` in the lobby).
- Existing enemy-set preservation checks remain: no missing pre-suspend enemy ids, no hp drift on preserved ids, no conjured non-spawner enemies after resume.
- Fallback telepipe capture recipe summary/comments no longer reference `restoreRunCheckpoint` or `suspendedRunSummary`; they describe the in-memory pause → `resumeSuspendedRunInPlace` flow.
- Re-running the harness screenshot capture for this ticket produces `metrics.json` with `"ok": true` and no `[capture:error]` line in `console.log`.

## Technical Specs

- **`harness/screenshot.mjs`**
  - **`stashObjective` handler (~979–985):** change objective source from `data?.harnessState?.suspendedRunSummary?.objective` to `data?.harnessState?.objective`.
  - **Suspended-state probe step (~355–360):** update `description` to expect `runStatus === "suspended"` and a live `harnessState.objective` (remove `suspendedRunSummary` references).
  - **`stashObjective` probe step:** also stash `runId` and `runStatus` from `harnessState` into `telepipeRunBaseline` so `assertRunPreserved` can verify id continuity.
  - **`assertRunPreserved` handler (~987–1070):** after reading stashed objective, assert resumed `harnessState.runId === entry.runId` and `harnessState.runStatus === "playing"`; keep existing enemy id/hp/add checks unchanged.
  - **Fallback recipe builder (~525–552):** update `summary` string and inline comments that still say `restoreRunCheckpoint` to describe in-memory suspend/resume.
  - **Top-of-file comment (~36):** replace checkpoint wording with in-memory pause wording if still present.

- **Out of scope:** do not modify `game/server/*` or reintroduce `suspendedRunSummary`, `captureRunCheckpoint`, or `restoreRunCheckpoint` (enforced by `game/server/test/server.test.js`).

## Verification: code
