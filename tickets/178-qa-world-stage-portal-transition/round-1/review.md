## Runtime health

PASS. The captured run starts and loads cleanly: `metrics.json` has `"ok": true`, the probe reaches `phase: "playing"` with a live canvas and connected state, `pageerrors` is empty, and `console.log` contains no pageerror or fatal lines from game code. The only client/server log noise is benign Vite/THREE/dev-server output.

## Acceptance criteria

### Implements the goal and stays scoped

FAIL. The code changes are narrowly scoped to QA support for this ticket: `game/client/main.js` exposes a live `layout` summary through `window.__AUTOGAME_HARNESS_STATE__()`, and `game/client/scripts/test-world-stage-transition.mjs` is a focused Playwright smoke script that boots isolated ports, drives register/lobby/ready/play, requests `sunken-canyon-stage`, checks the layout profile and player placement, and writes a snapshot.

However, the top-level ticket requires captured proof of the world-stage portal transition. The round-1 capture did not exercise the stage transition at all: `metrics.json` reports the fallback "lobby, movement, dodge/key-item" capture, `scenarios` is empty, and the screenshots are `01-initial.png`, `02-after-w.png`, `03-after-d.png`, and `04-after-dodge.png`. Those show lobby/default-stage movement and dodge cooldown, not a before/after transition into sunken-canyon.

There is a `game/docs/walkthroughs/world-stage-transition/snapshot.json` showing `before.layout.profile: "crowded"` and `after.layout.profile: "sunken-canyon"` with `playerOffsetFromStartRoom: 0`, which is good state evidence. But the same output directory contains no PNG screenshots, despite the ticket explicitly requiring at least two screenshots and the smoke script claiming to write `01-before-default-stage.png` and `02-after-sunken-canyon-stage.png`. The evidence package is therefore incomplete.

### Existing tests and clean load

PASS for the captured game load and visible changed-file test coverage. `coverage.log` shows Vitest completed successfully for the changed client-facing files: 3 files passed, 160 tests passed. The capture starts the game, reaches gameplay, and has no browser page errors. I did not find evidence in round-1 that the new `test:smoke:world-stage-transition` script itself was run as part of the final capture.

### Design and requirements consistency

PASS. The implementation does not alter game rules, movement, rendering, persistence, or server simulation. Exposing `layout.profile`, `seed`, `roomCount`, and `startRoom` in the harness state is consistent with the design document's dungeon/layout model and does not regress the foundation requirements for 3D rendering, server/client connectivity, multiplayer visualization, or movement synchronization.

### Code quality and integration

PASS. The added harness-state summary is defensive and preserves existing fields. The Playwright script follows the existing smoke-test style, uses isolated high ports with `--strictPort`, starts the server with `ALLOW_DEBUG_SCENARIOS=1`, waits for the relevant browser state, asserts the target layout and placement, and attempts process cleanup on both success and failure. I did not find dead or broken game code in the changed files.

### Debug scenario safety

PASS. This ticket did not add or change a debug scenario. The smoke script uses the existing `sunken-canyon-stage` scenario through the test-only `window.__requestDebugScenarioForTest()` path, and the server still gates debug scenarios through `ALLOW_DEBUG_SCENARIOS` / non-production-local checks. The same `sunken-canyon` layout is normally reachable through the `canyon_descent` quest's `layoutProfile: "sunken-canyon"`, so the shortcut is not the only route to the stage.

## Remaining gaps

1. The final evidence does not capture the required world-stage transition. The round-1 metrics/screenshots show only the fallback lobby/movement/dodge flow, and `game/docs/walkthroughs/world-stage-transition/` contains only `snapshot.json` with no before/after PNG screenshots. Re-run or wire the world-stage smoke capture so the ticket artifacts include the transition screenshots and state evidence proving the player enters the sunken-canyon stage and lands at its start room.

VERDICT: FAIL
