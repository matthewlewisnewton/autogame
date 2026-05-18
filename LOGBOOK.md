# LOGBOOK

Progress log for the autogame harness. Each entry below is a completed
top-level ticket — a verified-good state that was committed and git-tagged
`v0.N`. Entries are appended newest-last by `harness/run_ticket.sh`.

See `CONTEXT.md` for the project overview, `game/docs/design.md` for the
target game, and `TASKS.md` for the ticket backlog.

## v0.1 — Server Heartbeat System  (2026-05-17 21:25:46)

- **Foundation not regressed** — 3D scene, WebSocket connection, multiplayer
  visualization, and WASD movement sync all remain intact (screenshots
  `02`/`04` show two distinct player cubes and movement). Consistent with
  `requirements.md` and not in conflict with `design.md`.
- **No dead/broken code** — the unused `type` field in the client's heartbeat
  payload is explicitly specified by the ticket; `latency` is both stored and
  displayed as the ticket allows.

## Remaining Gaps
None.

## Notes (non-blocking, no action required)
- The stale-cleanup path emits `playerDisconnected` to other clients only
  indirectly, via the `disconnect` handler triggered by `socket.disconnect()`.
  If a socket were already `connected === false` while still present in
  `gameState.players`, the player would be deleted without a
  `playerDisconnected` broadcast. In practice the `disconnect` handler removes
  such players first, so this state is not reachable; worth keeping in mind if
  future code paths add players without a live socket.


## v0.2 — Input Validation on Server  (2026-05-17 21:35:21)

  movement synchronization (requirement 4) still functions. The client-side
  console log is clean (only Vite connection messages).
- The diff also includes harness changes (`harness/lib.sh`,
  `harness/run_subtask.sh`) and the three sub-ticket `ticket.md` files. These
  are harness/QA tooling, not game code, and do not affect or regress the
  game runtime.

## Code Quality

- No dead or broken code; both handlers guard-then-act with a single early
  return.
- No console errors in `console.log`; server log shows only normal
  connect/disconnect lines.
- Implementation matches the technical specs and is slightly more robust
  (explicit `Array.isArray` rejection).

## Remaining Gaps

None.


## v0.3 — Vite Socket.IO Proxy  (2026-05-17 21:41:22)

  constraints; this ticket is purely a dev-server wiring change and does not
  conflict with it.
- `game/docs/requirements.md` foundation item 2 ("frontend can successfully
  connect to the backend server via WebSockets") is preserved and arguably
  strengthened — the connection now works same-origin without CORS. Items 1, 3,
  and 4 (3D rendering, player visualization, WASD movement sync) remain intact
  per the screenshots and metrics. No regression.

## Code Quality

- No dead or broken code; the diff is minimal and surgical.
- No console errors attributable to this change.
- `vite.config.js` uses a plain object export (no `defineConfig` helper). This
  is valid and functional; `defineConfig` would only add editor type hints and
  is not required. Not a gap.

## Remaining Gaps

None.


## v0.4 — Delta-Time Movement  (2026-05-17 23:55:41)

  socket connects, players are represented as cubes, WASD updates local position and
  broadcasts. Screenshots `03-after-w` (blue cube moved north) and `04-after-d` (blue
  cube moved right) confirm movement and multiplayer sync still work after the change.
- `game/docs/design.md`: no conflict; this ticket is foundational movement plumbing and
  does not touch combat/cards/lobby.

## Code quality

- No dead or broken code; the single diff hunk is minimal and the explanatory comment
  (`main.js:101`) accurately describes the conversion.
- `console.log` shows only the `THREE.Clock` deprecation warning on both clients — no
  errors. `server.log` is clean (connect/disconnect only). `metrics.json` reports
  `ok: true` with a canvas present.
- Velocity is damped asymptotically and never hard-zeroed, but the `0.001` emit threshold
  bounds network chatter to a finite settle period — acceptable.

## Remaining gaps

(none)


## v0.5 — Client Reconnect UI  (2026-05-18 02:17:15)

  `init`/`stateUpdate`/`move`/`playerDisconnected` flow is preserved. The
  heartbeat refactor (`heartbeatStarted` flag → `heartbeatTimer` +
  start/stop helpers) is behavior-preserving and improves teardown.
- **Console / logs**: `console.log` is clean. `server.log` shows normal
  connect/disconnect. The `THREE.Clock` deprecation warning and the `vite ws
  proxy EPIPE` in `client.log` are pre-existing library/harness noise unrelated
  to this ticket.

## Code Quality

- No dead code remaining — the round-1 dead handlers are fixed.
- `updateStatus` cleanly unifies text + class + state tracking.
- Heartbeat lifecycle is correctly tied to connection state (stopped on
  disconnect, restarted on connect/reconnect, idempotent start).
- CSS classes match the hex values specified in the ticket exactly.

## Remaining Gaps

None.

