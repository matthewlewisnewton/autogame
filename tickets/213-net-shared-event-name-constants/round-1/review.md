## Per-Criterion Findings

### Runtime health
PASS. The captured game run is valid: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only normal Vite connection and scene-initialization output. The server/client logs show the game reached lobby and dungeon play; client log warnings are benign THREE/Vite socket-close noise. Coverage also completed successfully with 78 test files and 1350 tests passing.

### 1. Add canonical shared event names usable by both sides
PASS. `game/shared/events.json` defines canonical `serverToClient` and `clientToServer` maps, `game/shared/events.js` exposes CommonJS aliases for server tests/code, the server imports from `shared/events.js`, and the Vite client imports the JSON catalog directly. The captured browser run proves the JSON import path loads in the live client.

### 2. Replace duplicated literals incrementally across server and client
FAIL. Most high-volume server emits/listeners and `bindSocketHandlers(s).on(...)` client listeners now use `SERVER_TO_CLIENT` / `CLIENT_TO_SERVER`, but several live client server-event listeners still use raw wire strings:

- `window.__requestDebugScenarioForTest` calls `socket.once('debugScenarioResult', ...)` and `socket.off('debugScenarioResult', ...)`.
- `window.__configureDeckForTest` calls `socket.once('deckUpdate', ...)`, `socket.once('deckError', ...)`, and matching `off(...)` cleanup.
- `window.__evolveCardForTest` calls `socket.once('cardEvolutionResult', ...)`, `socket.once('cardEvolutionError', ...)`, and matching `off(...)` cleanup.

These are real client listeners for server-emitted events already present in the shared catalog. A typo or rename in any of these strings would silently break the test/debug hooks, which is exactly the drift this ticket is meant to prevent.

Socket.IO lifecycle strings such as `connect`, `disconnect`, `connect_error`, and server `disconnect` are acceptable framework events, not game wire-protocol events.

### 3. Add a drift guard asserting every server emit and client-on name resolves to a shared constant
FAIL. The new `game/server/test/socket_events_drift.test.js` scans server `.emit(...)` and `socket.on(...)`, plus client `s.on(...)` and `socket.emit(...)`, but it does not scan client `socket.once(...)` or `socket.off(...)`. As a result, the raw client listener strings above are not caught. This leaves the guard incomplete for the ticket's stated "every server-emit and client-on name" requirement.

### Design and requirements consistency
PASS. The implementation does not alter the documented lobby/dungeon/card core loop or foundational render, WebSocket, multiplayer, and movement requirements. The captured run confirms the client connects, renders, reaches gameplay, synchronizes movement, and uses key-item events without page errors.

### Debug scenarios
PASS. This ticket did not add or materially change a `?debugScenario=NAME` gameplay shortcut. It only touched the debug-scenario socket event naming path. Existing debug scenario entry points remain URL/test-hook driven and server-handled.

## Remaining gaps

1. Raw client server-event listener strings remain in `game/client/main.js`, and the drift guard misses them. Replace the `socket.once(...)`/`socket.off(...)` wire-string arguments in the test/debug helpers with `SERVER_TO_CLIENT.*` constants, and extend `game/server/test/socket_events_drift.test.js` so client `socket.once(...)` and relevant client listener cleanup strings cannot drift unnoticed.

VERDICT: FAIL
