# Capture: keep game server alive through lobby load

Round-1 top-level capture failed with `metrics.json` `"ok": false` /
`failure_kind: "capture_failed"`: the harness game server on the allocated port
(e.g. `3001`) accepted two socket connections then stopped listening, so Vite
logged repeated `/socket.io` `ECONNREFUSED` / 502 and `waitForGame` timed out.
Find and fix the crash or exit path so the server stays up through squad lobby
→ ready → dungeon transition during capture.

## Acceptance Criteria

- Running the harness capture flow on a non-default port pair (e.g. game
  `3001` / vite `5174`) leaves `server.log` ending with the process still
  listening (no silent exit after the second `Player connected` line).
- `client.log` and `console.log` contain **no** `/socket.io` 502 or
  `ECONNREFUSED 127.0.0.1:<game-port>` lines after both players reach lobby.
- `metrics.json` reports `"ok": true`, `pageerrors.json` is empty, and
  `window.__AUTOGAME_HARNESS_STATE__()` (or capture probes) show
  `connectionState: "connected"`, `phase: "playing"`, `hasCanvas: true`, and
  `lobbyVisible: false`.
- `game/server/index.js` logs uncaught errors from socket handlers instead of
  letting them terminate the Node process during normal dev/harness runs
  (`require.main === module`).
- Existing unit tests stay green; add or extend a server test that exercises
  the lobby → ready → deploy path without the HTTP server closing when handlers
  throw or reject (mock/stub as needed).

## Technical Specs

- **`game/server/index.js`**
  - Register `process.on('uncaughtException', …)` and
    `process.on('unhandledRejection', …)` when started as the main module:
    log stack/message to stdout/stderr and **do not** call `process.exit` for
    handler errors (tests that `require('./index')` must remain unaffected).
  - Audit socket handlers mounted in `startServer()` (especially lobby ready /
    deploy / `startDungeonRun` paths) and wrap or guard bodies that can throw
    synchronously so a single bad payload cannot tear down the process.
  - If a fatal boot error is found (e.g. double-listen, provider init throw),
    fix the root cause rather than only masking it.
  - Keep existing `/healthz` and `_harnessReady` behaviour unchanged unless a
    boot-order bug is identified.
- **`game/client/main.js`**
  - Ensure capture does not stall when the socket drops mid-lobby: verify
    `__AUTOGAME_HARNESS_STATE__` still exposes accurate `connectionState` /
    `phase` after reconnect, and that lobby UI state does not block
    `readyAll` (e.g. `#lobby` / `#ready-btn` remain usable when
    `#deck-editor` was opened earlier in the same session).
  - Do **not** change deck-booth feature behaviour from sub-tickets 01–02 unless
    a concrete crash/reconnect bug is traced to `openDeckBooth` or the debug
    booth hook.
- **`game/server/test/`** (natural home: integration or lobby handler tests)
  - Add a regression test: two authenticated sockets join the same lobby, both
    ready, server process still listening and emits dungeon/game state (no
    `server.listening === false` after handlers run).
- **Context:** `game/client/vite.config.js` already resolves
  `HARNESS_GAME_PORT` for the proxy; round-1 failure was an empty game-server
  port in `metrics.json` `port_holders`, not a wrong proxy target.

## Verification: code
