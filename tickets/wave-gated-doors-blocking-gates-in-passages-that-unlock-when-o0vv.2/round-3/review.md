# Senior Review

## Per-Criterion Findings

### Runtime Health Gate

Fail. The captured run is not valid proof that the game starts and loads cleanly. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and `console.log` records `page.goto: Page crashed` while navigating to `http://localhost:5174/`. The dev servers did start, and `pageerrors.json` is empty, so there is no sourceURL/line-number browser exception to quote, but the browser never reached a successful loaded game state and no screenshots or probes were captured.

This alone blocks the ticket under the runtime-health rules.

### Locked Gates Block Player Movement And Enemy Pathing

The implementation appears sound in code. Locked passage barriers are added to the same wall-collider set used by server movement validation and entity movement/pathing. The relevant server tests cover direct wall collision, server-authoritative player movement rejection, enemy `moveEntityToward` behavior while locked, and post-unlock traversal.

This criterion is satisfied by code and tests, but not by the failed live capture.

### Clearing A Bound Wave Unlocks Within One Tick And Clients See It Disappear

The server unlock path is wired from scripted enemy defeat to `unlockPassagesForWave()`, with a passage-lock changed callback rebuilding live wall colliders. The client receives `run.passageLocks`, rebuilds local colliders, removes unlocked gate meshes, and plays unlock VFX. Dialogue beacons for wave-cleared lines are also wired.

This criterion is satisfied by code and unit coverage, but the failed capture means there is no browser proof.

### Scripted Quest Chain: Room A Wave To Room B To Treasure/End Room

`training_caverns` tier 1 is now a selectable scripted quest with two passage locks: room 0 wave 0 opens the passage to room 1, and room 1 wave 0 opens the passage to the end room. The regression test walks that chain, verifies both gates independently, and confirms the end room does not spawn an extra wave.

This criterion is satisfied by code and tests.

### No Gates In Non-Scripted Quests; Telepipe Escape Still Works

Non-scripted deployments leave `passageLocks` empty and therefore do not add gate colliders. Telepipe suspend/resume preserves passage-lock state and rehydrates dialogue room-entry state; the added tests cover locked checkpoints and active enemy counts across resume.

This criterion is satisfied by code and tests.

### Design And Requirements Consistency

The implementation matches the design direction for PSO-style gated quest pacing: server-authored scripted locks, server-authoritative collision, visible client gates, unlock feedback, and radio/toast-style dialogue. It does not intentionally regress the foundation requirements for rendering, client/server architecture, multiplayer state, or movement synchronization, though the failed capture prevents live verification of those foundations.

### Debug Scenarios

The ticket touches debug scenarios, including Training Caverns shortcuts and boss-approach corrections. They remain gated through the existing localhost/debug socket path, with `?debugScenario=NAME` as the client entry point and server-side debug permission checks. The changed shortcuts are documented as QA shortcuts for states reachable through normal quest selection, deployment, add clears, and boss approach, and they do not replace the normal gameplay path.

No debug-scenario blocker found.

### Validation Notes

The changed-code coverage artifact did not complete cleanly: `coverage.log` ends with `[vitest] timed out after 120s — killing process group`. Relevant passage-lock and gate tests are present in the codebase, but the coverage run is only partial visibility. This is secondary to the failed browser capture.

## Remaining Gaps

1. The captured game run does not load cleanly: `metrics.json` has `"ok": false` / `failure_kind: "capture_failed"`, and `console.log` shows `page.goto: Page crashed` before screenshots or probes were produced. The next round must restore a clean browser capture before this ticket can pass.

VERDICT: FAIL
