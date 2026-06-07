1. Captured run fails: `metrics.json` has `"ok": false` and console reports `Telepipe run-preservation assertion failed: suspended objective was not captured before assertRunPreserved`.
   Files: game/client/main.js, game/server/progression.js
   Fix: handle/expose suspended checkpoint state in the browser: consume `runSuspended`/`stateUpdate.suspendedRunSummary`, include it in `window.__AUTOGAME_HARNESS_STATE__()`, and rerun capture until the suspended objective is visible and the run-preservation assertion passes.

2. New-sortie reset is not reachable through normal browser UI after telepipe suspend; only raw socket tests emit `abandonRun`.
   Files: game/client/main.js, game/client/index.html, game/server/socketHandlers/runHandlers.js
   Fix: show and wire suspended-run resume/abandon controls when `suspendedRunSummary` is present; `Abort Sortie` must emit `CLIENT_TO_SERVER.ABANDON_RUN`, clear the suspended checkpoint in the UI, then allow ready-up to start a fresh run with full card charges.

3. Design documentation contradicts the implemented ticket behavior by saying telepipe has no checkpoint/resume path and redeploy always starts a fresh dungeon.
   Files: game/docs/design.md
   Fix: update the Telepipe Evacuation section to the new policy: telepipe resume preserves card charge state for the same run, abandoning/starting a new sortie resets cards, and health/magic stones persist in both cases.
