# Harness: align Vite auth proxy with allocated game-server port

Round-1 review failed because screenshot capture never reached the lobby: the game
server listened on the harness-allocated port (e.g. `3002`) while Vite proxied
`/api` and `/socket.io` to the wrong target (`ECONNREFUSED` / 502). Wire the
allocated `PortAllocation.game_server` into the Vite dev-server process so
`game/client/vite.config.js` proxies auth to the same port the server binds.

## Acceptance Criteria

- `harness/steps/game.py` `start_game()` passes `HARNESS_GAME_PORT` (string equal
  to `ports.game_server`) into the Vite subprocess environment alongside the
  existing `--port` flag for `ports.vite`; the server subprocess continues to use
  `PORT=<ports.game_server>` as today.
- With `PortAllocation(game_server=3002, vite=5175)`, a harness capture produces
  `metrics.json` with `"ok": true` and `client.log` contains no
  `http proxy error` / `ECONNREFUSED` lines for `/api/register` or `/api/login`
  during the auth step.
- `server.log` from the same capture shows `Server listening on port 3002` (or
  whichever allocated game port was used) and auth requests succeed (no proxy
  mismatch).
- Unit test in `harness/tests/unit/` asserts the Vite `Popen` env includes
  `HARNESS_GAME_PORT` matching the `ports` argument passed to `start_game` (mock
  or spy on `subprocess.Popen`).
- `harness/lib.sh` `start_game` (bash fallback used by `run_subtask.sh`) honors
  `HARNESS_GAME_PORT` / `HARNESS_VITE_PORT` when set: server launched with
  `PORT=$HARNESS_GAME_PORT`, Vite with `--port $HARNESS_VITE_PORT` and
  `HARNESS_GAME_PORT` exported in the subshell so non-default parallel ports work
  on the bash path too.
- No changes to sunken-canyon layout, spawn, or client vista logic unless required
  for the proxy fix.

## Technical Specs

- `harness/steps/game.py` — in `start_game`, add explicit `env=` to the Vite
  `subprocess.Popen` call:
  `{**os.environ, "HARNESS_GAME_PORT": str(ports.game_server), "HARNESS_VITE_PORT": str(ports.vite)}`.
  Do not rely on inherited ambient env alone (parallel workers can have stale or
  missing `HARNESS_GAME_PORT` when only `ports` is authoritative).
- `harness/lib.sh` — extend `start_game <logdir>` to read
  `HARNESS_GAME_PORT` / `HARNESS_VITE_PORT` (default `3000` / `5173`), launch
  `PORT=$game_port node game/server/index.js`, and run Vite with matching
  `--port` and exported `HARNESS_GAME_PORT` in the client subshell.
- `game/client/vite.config.js` — verify existing proxy target
  `process.env.HARNESS_GAME_PORT || process.env.PORT || 3000`; change only if a
  bug remains after harness wiring (prefer harness fix first).
- `harness/tests/unit/test_game_start_proxy_env.py` (new) — test that
  `start_game(..., PortAllocation(3002, 5175))` passes `HARNESS_GAME_PORT=3002`
  into the Vite child env.
- Depends on sub-tickets **01–04** (already `.passed`); this ticket unblocks
  top-level visual QA and final review capture only.

## Verification: code
