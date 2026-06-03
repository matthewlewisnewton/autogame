## Per-Criterion Findings

### Runtime Health

PASS for startup/load health. `metrics.json` is present with `"ok": true`, no `harness_failure`, and `pageerrors: []`; `pageerrors.json` is empty. `console.log` contains only Vite connection and scene-init messages, and the server log shows both players connected and cleanly disconnected. The client log contains only allowed THREE deprecation warnings and Vite `ws proxy` / `EPIPE` shutdown noise.

The `metrics.json` probes confirm the full fallback smoke path reached a two-player lobby, transitioned to `playing`, rendered a canvas/card hand, accepted movement, and exercised the key-item cooldown HUD. The screenshot filenames listed in `metrics.json` were not present in the round folder, so the review relied on the structured probes and logs rather than raw PNG inspection.

### Goal: Surface Socket Connect/Reconnect Failure

FAIL. The implementation adds explicit Socket.IO connection options, a `CONNECT_WATCHDOG_MS` timer, and clears it on `connect`/`reconnect`. It also preserves the JWT/auth `connect_error` recovery path and surfaces a reload/retry failure state when no later socket event arrives before the timeout.

However, the watchdog is restarted on every non-auth `connect_error` and every `reconnect_attempt`. In a rapid retry loop, where connection attempts fail quickly and retry again within the 10 second watchdog window, each retry signal clears and recreates the timer. That can indefinitely postpone the persistent `"Connection failed — reload to retry"` surface and leave the user stuck with only transient `"Connection failed — retrying..."` / `"Reconnecting..."` status, which is the failure mode this ticket is meant to close.

The added tests cover a silent socket that emits no events after creation/drop and a timely recovery, but they do not simulate repeated non-auth `connect_error` or `reconnect_attempt` events arriving faster than the timeout. That missing case is the core robustness requirement for the reported rapid sequential-session flake.

### Scope, Design, and Requirements

PASS for scope and foundation compatibility. The code change is limited to client socket lifecycle handling and tests. It does not alter lobby rules, combat, persistence, rendering architecture, or the documented lobby/dungeon loop in `game/docs/design.md`.

The captured run continues to satisfy `game/docs/requirements.md`: Three.js scene initialization succeeds, authenticated Socket.IO connections are established, multiplayer state reaches two players, and WASD movement is exercised by the probe.

### Debug Scenarios

PASS. This ticket did not add or modify a `?debugScenario=NAME` shortcut. Existing debug-scenario handling remains gated to localhost and is not part of normal gameplay entry.

### Tests and Coverage

PASS with a gap in scenario coverage. The provided `coverage.log` shows the client suite passed: 3 test files, 164 tests. Coverage visibility includes the changed client files, and the observed stderr is the existing model-loading fallback noise in jsdom tests rather than a failing assertion.

## Remaining Gaps

1. Persistent socket retry loops can keep resetting the watchdog before it fires.
   Files: `game/client/main.js`, `game/client/test/main.test.js`.
   Fix: keep an absolute failure deadline for a socket connect/reconnect episode, or only start the watchdog when one is not already active after the socket has been created/dropped. Add a test that repeatedly emits non-auth `connect_error` and/or `reconnect_attempt` faster than `CONNECT_WATCHDOG_MS` and verifies the persistent reload/retry error still appears after the original bounded window.

VERDICT: FAIL
