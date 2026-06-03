# Test start_game lifecycle and vite-retry

Add unit tests for `start_game` in `harness/steps/game.py`: log-dir setup,
stale-log cleanup, pre-launch port freeing, server/vite launch with PID
tracking, and the vite EADDRINUSE retry loop. None of this is currently
exercised. This sub-ticket adds tests only; it must not change `game.py`
production code.

## Acceptance Criteria

- A new test file `harness/tests/unit/test_game_start.py` exists and all its
  tests pass under `python -m pytest`.
- A test asserts `start_game` creates the log directory and removes/`chmod`s any
  stale `server.log` and `client.log` before launching (no crash when a stale
  read-only log exists).
- A test asserts `start_game` calls `wait_port_free` for BOTH `ports.vite` and
  `ports.game_server` before launching.
- A test asserts the server is launched via `subprocess.Popen(["node",
  "game/server/index.js"], ...)` with the `PORT` env var set to
  `ports.game_server` and `start_new_session=True`, and that its PID is appended
  to `game._GAME_PIDS`.
- A test asserts a clean vite start (no EADDRINUSE in `client.log`) appends the
  vite PID to `game._GAME_PIDS` and `start_game` returns after the first
  attempt.
- A test asserts the retry path: when `client.log` contains `EADDRINUSE` on the
  first attempt, `start_game` calls `_kill_proc_group` on the vite proc, pops the
  failed PID, and retries; if all `max_vite_retries` attempts show EADDRINUSE it
  gives up without raising (and logs an error).
- Tests isolate `game._GAME_PIDS` (clear it before/after each test) so module
  state does not leak between tests.
- Existing `harness/tests/unit/test_game_*.py` tests still pass and `game.py` is
  unchanged.

## Technical Specs

- New file: `harness/tests/unit/test_game_start.py`.
- Import `harness.steps.game as game` and `from harness.workspace.ports import
  PortAllocation`.
- Monkeypatch `game.subprocess.Popen` with a fake returning an object exposing
  `.pid`; `game.time.sleep` to a no-op; `game.wait_port_free` to record calls;
  `game._kill_proc_group` to record calls. Drive the vite-retry branch by making
  the fake Popen (or a `monkeypatch` on the client log path) write the desired
  `client.log` contents per attempt — e.g. write `"EADDRINUSE"` for the first
  attempt(s) and clean output for a later one.
- Use a `tmp_path` logdir and a `PortAllocation(game_server=3000, vite=5173)`
  (and a non-default-port variant if helpful). Pass `max_vite_retries` small
  (e.g. 2) to keep retry tests fast.
- Use a fixture that snapshots and restores `game._GAME_PIDS`.

## Verification: code
