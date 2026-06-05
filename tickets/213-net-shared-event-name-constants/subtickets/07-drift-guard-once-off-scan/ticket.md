# 07 — Drift guard covers `socket.once` and `socket.off`

The drift test from sub-ticket 05 scans `s.on` and `socket.emit` but not one-shot listeners. Extend it so any future raw string in client `socket.once` / `socket.off` (or reintroduced literals after sub-ticket 06) fails CI.

## Acceptance Criteria

- `game/server/test/socket_events_drift.test.js` scans `game/client/main.js` for string-literal first arguments to `socket.once(` and `socket.off(`.
- Custom server→client event names must resolve to a value in `events.json` `serverToClient`; Socket.IO built-ins (`connect`, `disconnect`, `connect_error`) stay allowlisted.
- A deliberate offender such as `socket.once('typoEvent', …)` in `main.js` causes the test to fail with a file:line message.
- With sub-ticket 06 applied, the expanded test passes (no offenses in production `main.js`).
- Existing server-side scans (`.emit(`, `socket.on(`, `s.on(`, `socket.emit(`) are unchanged and still pass.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/test/socket_events_drift.test.js`.
- Add regex helpers (mirror existing `S_ON_LITERAL` / `SOCKET_EMIT_LITERAL` style), e.g. `SOCKET_ONCE_LITERAL` and `SOCKET_OFF_LITERAL`, applied inside `scanClientMain()`.
- Assert against `serverToClient` set (same as `s.on` checks); reuse `SOCKET_IO_ALLOWLIST`.
- Update the client-facing `it(...)` description to mention `socket.once` / `socket.off`.
- Optional: extend the sample-snippet unit test to include a `socket.once('typoEvent', …)` hit.
- **Depends on** sub-ticket 06 (client literals replaced); implement after 06 or in the same branch once 06 is merged.
- Do not modify passed sub-tickets 01–05 or review artifacts.

## Verification: code
