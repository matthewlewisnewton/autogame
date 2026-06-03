# Test stop_game cleanup and wait_for_game polling

Add unit tests for `stop_game` and `wait_for_game` in
`harness/steps/game.py`: tracked-PID group kills, serial-vs-parallel pkill
pattern selection, and the readiness polling loop. The `_http_ok` /
`_http_responding` helpers are already tested, but the `wait_for_game` loop and
all of `stop_game` are not. This sub-ticket adds tests only; it must not change
`game.py` production code.

## Acceptance Criteria

- A new test file `harness/tests/unit/test_game_stop_wait.py` exists and all its
  tests pass under `python -m pytest`.
- A `stop_game` test asserts every PID in `game._GAME_PIDS` is killed via
  `_kill_proc_group` with `SIGTERM` (15) and that `game._GAME_PIDS` is empty
  afterward.
- A `stop_game` test asserts the SERIAL path (`ports=None`) issues `pkill -f`
  with BOTH a `server/index.js` pattern and a vite `--port 5173` pattern.
- A `stop_game` test asserts the PARALLEL path (`ports` given) issues a `pkill`
  for ONLY the worker's own vite port pattern and does NOT issue the blanket
  `server/index.js` pkill (which would kill sibling workers' servers).
- A `wait_for_game` test asserts it returns `True` once BOTH the client
  (`_http_ok` on `ports.vite`) and the server (`_http_responding` on
  `ports.game_server`) report up.
- A `wait_for_game` test asserts it returns `False` on timeout when the server
  never responds, and that it polls the expected client/server URLs derived from
  `ports`.
- Tests isolate `game._GAME_PIDS` and keep the loops fast (no real sleeps).
- Existing `harness/tests/unit/test_game_*.py` tests still pass and `game.py` is
  unchanged.

## Technical Specs

- New file: `harness/tests/unit/test_game_stop_wait.py`.
- Import `harness.steps.game as game` and `from harness.workspace.ports import
  PortAllocation`.
- For `stop_game`: monkeypatch `game._kill_proc_group` to record `(pid, sig)`
  calls, `game.subprocess.run` to capture the `pkill -f <pattern>` argv list,
  and `game.time.sleep` to a no-op. Assert on the captured patterns (e.g. the
  serial path produces two patterns, the parallel path one containing the
  worker's `--port <vite>`). Seed `game._GAME_PIDS` via a snapshot/restore
  fixture.
- For `wait_for_game`: monkeypatch `game._http_ok` and `game._http_responding`
  (capture the URLs they are called with) and `game.time.sleep`. Drive the
  success case by making both return `True`, and the timeout case by making the
  server probe always return `False` with a short `timeout_s`.

## Verification: code
