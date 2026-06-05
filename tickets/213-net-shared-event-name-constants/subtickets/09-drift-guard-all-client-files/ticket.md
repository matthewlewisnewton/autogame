# 09 — Drift guard scans all production client socket files

The drift test from sub-tickets 05 and 07 only scans `game/client/main.js`. Extend it to cover every production client module that emits or listens on custom Socket.IO events so raw literals in `renderer.js` or `characterBooth.js` cannot pass CI unnoticed.

## Acceptance Criteria

- `game/server/test/socket_events_drift.test.js` scans all production client socket files, at minimum: `client/main.js`, `client/renderer.js`, and `client/characterBooth.js`.
- Client scans cover string-literal first arguments to `s.on(`, `socket.emit(`, `socket.once(`, `socket.off(`, and `socketRef.emit(` (renderer movement/loot/booth path).
- Custom client→server emit names must resolve to a value in `events.json` `clientToServer`; custom server→client listener names must resolve to `serverToClient`. Socket.IO built-ins (`connect`, `disconnect`, `connect_error`, `reconnect`, `reconnect_attempt`) stay allowlisted.
- A deliberate offender such as `socketRef.emit('typoEvent', …)` in `renderer.js` causes the test to fail with a `file:line` message.
- With sub-ticket 08 applied, the expanded test passes (no offenses in production client files).
- Existing server-side scans are unchanged and still pass.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/test/socket_events_drift.test.js`.
- Replace the `scanClientMain()` single-file helper with a `CLIENT_PRODUCTION_FILES` list and a reusable `scanClientFile(relativePath)` (or equivalent) that runs the same listener/emit checks per file.
- Add a regex for `socketRef.emit(` literals (mirror `SOCKET_EMIT_LITERAL`), e.g. `SOCKET_REF_EMIT_LITERAL = /socketRef\.emit\s*\(\s*['"]([^'"]+)['"]/g`.
- Extend `SOCKET_IO_ALLOWLIST` if needed for `reconnect` / `reconnect_attempt` literals present in `main.js`.
- Update the client-facing `it(...)` description to state it covers all listed production client files, not only `main.js`.
- Optional: extend the sample-snippet unit test to include a `socketRef.emit('typoEvent', …)` hit.
- **Depends on** sub-ticket 08 (client literals replaced); implement after 08 or in the same branch once 08 is merged.
- Do not modify passed sub-tickets 01–07 or review artifacts.

## Verification: code
