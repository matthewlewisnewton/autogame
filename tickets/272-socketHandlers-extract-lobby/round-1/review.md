## Runtime health

The captured game run is clean enough to judge the ticket. `metrics.json` reports `"ok": true`, the browser reached the lobby and playing phases with two connected players, and `pageerrors` is empty. `console.log` contains Vite connection messages and 409 resource responses, but no `pageerror` or `[fatal]` lines from game code. Server/client logs show the expected server startup, connections, disconnects, allowed THREE deprecation warnings, and allowed Vite `EPIPE` socket-close noise.

Coverage verification also passed: `coverage.log` reports 42 test files passed and 942 tests passed.

## Acceptance criteria

### Lobby handlers moved into a module and registered via ctx

Pass. The lobby/run/play/disconnect socket handlers were removed from the `io.on('connection')` closure in `game/server/index.js` and moved to `game/server/socketHandlers/lobbyHandlers.js`. `index.js` now builds a per-connection `ctx` containing identity, lobby helpers, IO, progression/card/debug helpers, and registers the module with `lobbyHandlers.register(socket, ctx)`.

The new module avoids requiring `index.js` directly, which preserves the intended circular-dependency boundary. Its imports cover shared constants and progression APIs, while `ctx` supplies index-local helpers such as lobby context switching, lobby join/reconnect/leave, debug scenario application, and disconnect handling.

### Behaviour preserving

Pass. The live code keeps the same socket event surface for lobby browser, key items, deck/shop/trade, run lifecycle, playing-phase actions, debug scenario dispatch, heartbeat, loot pickup, and disconnect. Context-sensitive operations still execute through `withLobbyFromSocket`, `withLobbyPlayer`, or `withLobbyContext`, so progression and simulation state continue to point at the active lobby while handlers run.

The captured smoke flow exercised lobby creation/join, readiness transition into gameplay, movement, card/key-item HUD state, and dodge cooldown without browser errors. No new debug scenario was added by this ticket; the existing `debugScenario` socket handler was only moved, and the capture used normal gameplay (`debugScenario: null`).

### Server test suite green

Pass. The round's coverage run reports `42 passed (42)` test files and `942 passed (942)` tests. Coverage visibility shows changed server code remains covered through the existing server/integration suite.

## Design and requirements consistency

Pass. The extraction does not alter the documented lobby-to-dungeon core loop, socket-authenticated multiplayer structure, 3D rendering path, player representation, or movement synchronization. The captured run confirms server/client WebSocket connectivity, multiplayer lobby state, movement into gameplay, and synchronized state updates still work.

## Code quality

Pass. The change is scoped to the intended server socket-handler extraction. There is no obvious dead path, missing export, broken import, or runtime error in the moved module. The ctx boundary is explicit and keeps index-local helpers out of the handler module's dependency graph.

## Remaining gaps

None.

VERDICT: PASS
