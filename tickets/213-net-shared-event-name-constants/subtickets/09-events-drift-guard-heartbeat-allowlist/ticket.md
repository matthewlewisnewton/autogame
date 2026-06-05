# Remove heartbeat/heartbeat_ack from drift-guard lifecycle allowlist

`heartbeat` and `heartbeat_ack` are real gameplay/wire events that already live
in the shared registry and are emitted/listened for via `EVENTS.heartbeat` /
`EVENTS.heartbeat_ack`. They are wrongly listed in `LIFECYCLE_ALLOWLIST`, which
means a raw-string call site for either name would silently pass the drift guard
instead of being forced through `EVENTS.*`. Remove them so the guard protects
these two events like every other gameplay event.

## Acceptance Criteria

- `LIFECYCLE_ALLOWLIST` in `game/server/test/event_name_drift.test.js` no longer
  contains `'heartbeat'` or `'heartbeat_ack'`.
- `LIFECYCLE_ALLOWLIST` still contains only true Socket.IO/transport/Node
  process lifecycle names (e.g. `connection`, `connect`, `disconnect`,
  `connect_error`, `error`, `uncaughtException`, `unhandledRejection`,
  `reconnect`, `reconnect_attempt`).
- `heartbeat` and `heartbeat_ack` remain keys in `game/shared/events.json`
  (they are NOT removed from the registry).
- All production heartbeat call sites continue to reference the registry
  (`EVENTS.heartbeat` / `EVENTS.heartbeat_ack`) — no raw string literals are
  introduced for these names anywhere in the scanned files.
- The full drift-guard test suite passes with the allowlist trimmed, including
  invariant 1 (no raw gameplay literals) and invariant 3 (no dead registry
  entries) for `heartbeat`/`heartbeat_ack`.

## Technical Specs

- `game/server/test/event_name_drift.test.js`: delete the `'heartbeat',` and
  `'heartbeat_ack',` lines (currently lines 61–62) from the
  `LIFECYCLE_ALLOWLIST` Set. Do not change any other allowlist entries.
- Do NOT modify `game/shared/events.json` — `heartbeat` and `heartbeat_ack`
  must stay as registry keys so the existing `EVENTS.heartbeat` /
  `EVENTS.heartbeat_ack` references still resolve.
- Verify no other change is needed: production call sites already use the
  registry constants —
  - `game/client/main.js`: `s.on(EVENTS.heartbeat_ack, ...)` and
    `socket.emit(EVENTS.heartbeat, ...)`,
  - `game/server/socketHandlers/lobbyHandlers.js`:
    `socket.on(EVENTS.heartbeat, ...)` and `socket.emit(EVENTS.heartbeat_ack, ...)`.
  So removing the allowlist entries should keep the test green; if it fails,
  fix the offending raw literal rather than re-adding the allowlist entry.

## Verification: code
