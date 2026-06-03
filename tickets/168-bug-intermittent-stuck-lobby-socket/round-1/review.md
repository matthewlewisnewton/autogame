## Per-Criterion Findings

### Runtime health and existing tests

The captured game run is healthy. `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite connection and scene initialization lines; `client.log` has only benign THREE/Vite socket-close noise, and `server.log` shows both players connected, played, and disconnected cleanly. The fallback smoke capture reached lobby, gameplay, movement, and dodge probes successfully.

The provided coverage run reports the changed client tests passing: 162 tests across 3 client test files. The model-load stderr in `coverage.log` is existing test-environment fallback noise and did not fail the suite.

### Implements the goal and is scoped to it

Partial, but not complete. The implementation adds explicit Socket.IO connection options and a one-shot client watchdog when `createSocket()` is called. That covers the fresh-socket case where the socket never reaches `connect`, and it preserves the JWT/auth `connect_error` recovery path.

The top-level ticket, however, is specifically about rapid-session connection/reconnect timing flakes and the risk that a dropped socket leaves the player stuck without a clear surfaced failure. After a successful `connect`, the new watchdog is cleared and is never restarted on `disconnect`, `reconnect_attempt`, or persistent non-auth `connect_error`. Because reconnection attempts are configured as infinite, a post-connect drop can still sit forever in transient `Disconnected`, `Reconnecting...`, or `Connection failed — retrying...` status without reaching the persistent reload/retry error state. That misses the reconnect/drop portion of the goal.

### Design and foundation consistency

The change stays within the client networking surface and does not alter lobby rules, dungeon flow, combat, persistence, or server-side authority. The captured run still satisfies the foundation requirements: WebSocket connection, multiplayer visualization, and synchronized movement are intact.

### Debug scenarios

No development debug scenario was added or changed. `metrics.json` reports an empty `scenarios` list, so the debug-scenario gating/reachability checks are not applicable.

## Remaining gaps

1. A dropped socket after an initial successful connection still has no bounded reconnect failure path. The watchdog only starts in `createSocket()` and is cleared on `connect`/`reconnect`; it is not restarted for later `disconnect`, `reconnect_attempt`, or repeated non-auth `connect_error`, so infinite reconnection can still leave the player stuck in transient status forever.

VERDICT: FAIL
