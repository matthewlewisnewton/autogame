# Distinct run-failure summary reason when the escort NPC dies

When the escort NPC dies the run already ends as `failed`, but the run-summary overlay only shows the generic "signal lost" heading — the player cannot tell the escort death caused the failure. Surface a distinct failure reason in the server summary payload and render it on the client failure screen.

## Acceptance Criteria

- `buildRunSummary` in `game/server/progression.js` includes a top-level `failReason` string when the run failed because of the escort (e.g. "Archivist Vale was lost — escort failed"), and `failReason` is `null`/absent for victories and for non-escort failures.
- The run-summary overlay in the client shows the `failReason` text on a dedicated line when present, and that line is hidden/empty when there is no `failReason` (victories, ordinary wipes).
- A server test in `game/server/test/escort_objective.test.js` kills the escort NPC, lets the run fail, and asserts the summary payload carries the distinct escort `failReason`.
- `cd game && npx vitest run server/test/escort_objective.test.js` passes.

## Technical Specs

Files to change (only these):
- `game/server/progression.js` — in `buildRunSummary` (~line 1503): add `failReason: status === 'failed' && run.escort?.failed ? run.objective.label : null` (the escort fail path already rewrites `run.objective.label` to "<npc> was lost — escort failed" in `failEscortRun`, escort.js:~95, so reuse it; do not change escort.js).
- `game/client/index.html` — add `<div id="summary-reason"></div>` inside `#run-summary-overlay` (after `#summary-status`, ~line 253).
- `game/client/main.js` — bind `summaryReasonEl = document.getElementById('summary-reason')` next to the other summary element bindings (~line 988); in `showRunSummary` (~line 4825) set `summaryReasonEl.textContent = data.failReason || ''` and toggle its `display` so it only shows when `failReason` is non-empty.
- `game/server/test/escort_objective.test.js` — add a test: deploy the escort fixture quest, set the escort minion's hp to 0, run the damage/death path (`onEscortDamaged`/`onEscortDeath` via the wired instance) plus `checkRunTerminalState()`, then assert `buildRunSummary('failed').failReason` matches the "<npc> was lost — escort failed" label.

## Verification: code
