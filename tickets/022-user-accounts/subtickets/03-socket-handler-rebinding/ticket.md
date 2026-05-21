# Socket Handler Rebinding on Recreate

Extract all `socket.on(...)` registrations into a single `bindSocketHandlers(socket)` function and call it every time a new Socket.IO socket is created. This ensures that after login (which replaces the socket), the authenticated connection receives all game events.

## Acceptance Criteria
- `game/client/main.js` contains a function `bindSocketHandlers(socket)` that registers **all** `socket.on(...)` and `socket.io.on(...)` event listeners.
- `createSocket(token)` calls `bindSocketHandlers(socket)` after creating the new socket instance.
- The initial page-load path (with stored token) also goes through `bindSocketHandlers` — no handlers are attached outside this function.
- All existing event handlers are present: `connect`, `disconnect`, `reconnect_attempt`, `reconnect`, `init`, `stateUpdate`, `heartbeat_ack`, `debugScenarioResult`, `playerDisconnected`, `cardUsed`, `cardError`, `deckUpdate`, `deckError`, `lobbyUpdate`, `startGame`, `runComplete`, `runFailed`.
- Unit tests in `game/client/test/main.test.js` verify that `bindSocketHandlers` is called for the login-created socket (using a mock that returns distinct socket instances).

## Technical Specs
- **Modify**: `game/client/main.js` —
  - Create `function bindSocketHandlers(s) { ... }` and move every `socket.on(...)` and `socket.io.on(...)` call into it, referencing the parameter `s` instead of the global `socket`.
  - In `createSocket(token)`, after `socket = io({ auth })`, call `bindSocketHandlers(socket)`.
  - Remove all standalone `socket.on(...)` calls outside `bindSocketHandlers`.
  - Ensure closures/callbacks inside handlers that reference outer-scope variables still work (they should, since they close over module scope, not the socket).
- **Modify**: `game/client/test/main.test.js` — add a test that creates two distinct socket mocks (one for initial load, one for post-login) and verifies handlers are bound on the second socket.
- **Modify**: `game/client/test/setup.js` — update the Socket.IO mock so `io()` returns a new mock socket each call (not a cached singleton), so the test can detect whether handlers are rebound.

## Verification: code
