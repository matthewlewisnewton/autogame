# Review: 213-net-shared-event-name-constants

## Per-Criterion Findings

### Runtime Health

Fail. The required captured run is not clean: `round-3/metrics.json` contains `"ok": false` with `failure_kind: "capture_failed"`, and the required `round-3/console.log` file is missing. The available `client.log` and `server.log` tails show Vite and the game server reached their ready/listening messages, and `metrics.json` does not report browser `pageerrors` or a `harness_failure` block, but the capture still did not produce runnable proof. Per the ticket review rules, this alone is a blocking failure.

No screenshots, probes, scenarios, `capturePlanSource`, or `capturePlanSummary` were present in the round-3 evidence because the capture failed before producing them.

### Acceptance Criterion 1: Shared Event Registry

Pass on code inspection. `game/shared/events.json` defines the canonical socket event vocabulary and is imported by both Node/CommonJS server modules and browser client modules. The changed server files use `require('../shared/events.json')` / `require('../../shared/events.json')`, while the changed client files import the JSON registry through Vite.

### Acceptance Criterion 2: Replace Event Literals Incrementally

Pass on code inspection. Production server/client socket `.emit`, `.on`, `.once`, and `.off` call sites in the ticket scope now route through `EVENTS.*` constants. The dynamic run-result emit in `game/server/progression.js` also uses `EVENTS.runComplete` / `EVENTS.runFailed`, and phase-mismatch dynamic emit defaults use registry constants instead of raw event strings.

Remaining raw event-name strings found by search are in tests, comments, log labels, payload fields, or non-game Socket.IO lifecycle listeners such as `connect` / `disconnect`; I did not find a production gameplay socket event literal that would silently drift from the shared registry.

### Acceptance Criterion 3: Drift Guard Test

Pass with one non-blocking caveat. `game/server/test/event_name_drift.test.js` statically scans the expected production server/client event surfaces, rejects raw gameplay event literals, verifies `EVENTS.<name>` references resolve to `events.json`, and verifies registry keys are used. The coverage run shows this file passed: `server/test/event_name_drift.test.js (5 tests)`.

The broader coverage run did not finish green: `server/test/integration.test.js > magic stone drops — any player can pick up > enemy death spawns magic_stone and currency loot entries any player can reach` failed with `expected 30.005 to be 30`. That failure appears unrelated to this event-name registry change, but it is still a test-health issue in the captured evidence.

### Design And Requirements Consistency

The implementation preserves the existing Socket.IO client/server architecture described in `CONTEXT.md` and does not change the core loop, combat model, movement synchronization, or rendering requirements in `game/docs/design.md` and `game/docs/requirements.md`. The event registry is a mechanical maintainability improvement around existing network messages.

### Debug Scenarios

No new debug scenario state shortcut was added by this ticket. The existing `debugScenario` socket event was moved behind the shared registry and remains gated by the URL parameter on the client plus the existing local/dev server-side allowance.

## Remaining gaps

1. The captured game run did not complete cleanly. `metrics.json` has `"ok": false` / `failure_kind: "capture_failed"`, and `console.log` is missing, so there is no valid proof that the game starts and loads with this ticket applied.

VERDICT: FAIL
