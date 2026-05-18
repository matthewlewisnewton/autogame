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

