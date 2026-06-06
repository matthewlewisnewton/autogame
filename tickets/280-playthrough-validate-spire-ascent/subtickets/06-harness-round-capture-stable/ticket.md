# Harness round capture: keep game server alive through screenshot pass

Round-2 ticket capture failed with `metrics.json` `"ok": false` / `failure_kind: "capture_failed"`: the game server bound on the allocated port, one player connected, then `server.log` records `[server] SIGTERM received` and Vite logged repeated `connect ECONNREFUSED 127.0.0.1:<port>` while `screenshot.mjs` timed out waiting for gameplay. Sub-ticket 05 fixed game-side deploy stability and its own sub-ticket QA capture passes, but the top-level `capture_run` in `harness/pipelines/ticket.py` still loses the backend mid-run. Fix harness process lifecycle so the round capture completes with `metrics.json` `"ok": true` and movement screenshots present.

## Acceptance Criteria

- Running `capture_run` on a non-default port pair (e.g. game `3004` / Vite `5177`) into a fresh artifact directory: `server.log` shows `Server listening on port <port>` and **no** `[server] SIGTERM received` line before capture finishes; `port_holders[<game_port>]` is non-empty while capture is in progress.
- After Vite is ready, `client.log` contains **no** `connect ECONNREFUSED 127.0.0.1:<game_port>` and no repeated `/socket.io` / `/api/register` / `/api/login` proxy 502 errors through the ready→playing transition.
- `metrics.json` in the capture output directory has `"ok": true`, `pageerrors` is empty, probes show `connectionState: "connected"`, `phase: "playing"`, and `hasCanvas: true`, and at least the fallback movement screenshots (`01-initial.png` through `04-after-dodge.png` or equivalent) exist — not a lone `01-initial.png` with a `page.waitForFunction` timeout.
- `stop_game(ports)` on the parallel path kills **only** the server/vite processes started for that port allocation (tracked PID + port-scoped patterns); a sequential sub-ticket teardown must not SIGTERM a server started by a subsequent `capture_run` on the same ports.
- `python -m pytest harness/tests/unit/test_game_stop_wait.py harness/tests/unit/test_capture_run_diagnostics.py -q` passes; add or extend a regression test that reproduces premature server SIGTERM during an in-progress capture if the root cause is identified.
- Do **not** modify passed sub-tickets 01–05 or their artifact trees.

## Technical Specs

- **`harness/steps/game.py`**
  - Primary target per round-2 review: `_GAME_PIDS` is module-global; audit whether stale or cross-session PID tracking lets `stop_game(ports)` SIGTERM a server that belongs to an active `capture_run`.
  - Extend parallel-path teardown to reclaim the game server by port (e.g. track `{pid, game_port, role}` at `start_game` time, or port-scoped `pkill`/`ss` filter matching `PORT=<ports.game_server>`) without blanket-killing sibling workers' servers.
  - Ensure `start_game` resets or scopes tracked PIDs per launch so a new capture cannot inherit kills meant for a prior session.
- **`harness/steps/capture_run.py`**
  - If lifecycle ownership belongs here: bind `start_game`/`stop_game` to a capture-scoped PID set so the `finally: stop_game(ports)` block cannot be triggered early by another harness step, and ensure diagnosis runs before teardown when capture fails.
- **`game/server/index.js`**
  - Only if still required after harness fix: confirm existing SIGTERM logging is sufficient for diagnosis; do not rework deploy logic already landed in sub-ticket 05 unless a new crash path is found.
- **Verification repro:** from repo root, invoke `capture_run` the same way `harness/pipelines/ticket.py` does (allocated `PortAllocation`, artifact dir under `tickets/280-playthrough-validate-spire-ascent/round-2/` or a fresh `_probe_capture` sibling). Round-2 failure artifacts at `tickets/280-playthrough-validate-spire-ascent/round-2/{metrics.json,server.log,client.log,screenshot.log}` are the baseline.

## Verification: code
