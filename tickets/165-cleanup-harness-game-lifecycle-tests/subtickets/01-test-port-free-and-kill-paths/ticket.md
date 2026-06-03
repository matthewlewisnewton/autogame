# Test wait_port_free and the kill/port-free paths

Add unit tests for the port-freeing and process-kill helpers in
`harness/steps/game.py` — `port_in_use`, `wait_port_free`, `_kill_pid`, and
`_kill_proc_group`. These are the exact paths behind the prior orphan-proc /
EADDRINUSE bugs (harness-fixes-2026-05-31) and currently have no test at all.
This sub-ticket adds tests only; it must not change `game.py` production code.

## Acceptance Criteria

- A new test file `harness/tests/unit/test_game_port_free.py` exists and all its
  tests pass under `python -m pytest`.
- `port_in_use` is covered for both a bound port (returns `True`) and a free
  port (returns `False`) — e.g. by binding a real socket or monkeypatching the
  socket bind.
- `wait_port_free` is covered for: (a) returns `True` immediately when the port
  is already free; (b) kills a harness-owned holder (cmdline matching the
  server/vite pattern) and then returns `True` once the port frees; (c) returns
  `False` on timeout when the port stays bound; (d) when the only holder is a
  foreign proc (non-harness cmdline) it is NOT killed and the function returns
  `False` after the deadline; (e) with `HARNESS_BROAD_PORT_KILL=1` set, even a
  foreign holder IS killed.
- A test asserts `wait_port_free` forwards its `vite_port` argument so a
  non-default vite port (e.g. 5177) is recognised as harness-owned.
- `_kill_pid` is covered for: it calls `os.kill(pid, signal)` and silently
  swallows `ProcessLookupError` and `PermissionError`.
- `_kill_proc_group` is covered for: it signals the process group via
  `os.killpg(os.getpgid(pid), sig)`, and falls back to `_kill_pid` when the
  group lookup/kill raises `ProcessLookupError`/`OSError`.
- Existing `harness/tests/unit/test_game_*.py` tests still pass and `game.py` is
  unchanged.

## Technical Specs

- New file: `harness/tests/unit/test_game_port_free.py`.
- Import targets from `harness.steps.game`: `port_in_use`, `wait_port_free`,
  `_kill_pid`, `_kill_proc_group` (plus `_port_holders` to monkeypatch holder
  lists).
- Use `monkeypatch.setattr(game, "_port_holders", ...)` to return controlled
  `[(pid, cmdline)]` lists, `monkeypatch.setattr(game, "_kill_pid", ...)` /
  `"_kill_proc_group"` and `"port_in_use"` to observe kills and simulate the
  port freeing after a kill, and `monkeypatch.setattr(game.time, "sleep", ...)`
  to keep the loop fast. Use `monkeypatch.setenv`/`delenv` for
  `HARNESS_BROAD_PORT_KILL`.
- For `_kill_pid` / `_kill_proc_group`, patch `game.os.kill`, `game.os.killpg`,
  and `game.os.getpgid` to record calls or raise the relevant exceptions.
- Reference cmdlines: harness-owned `"node game/server/index.js"` and
  `"vite --port 5173 --strictPort"`; foreign `"node /srv/other-app/server.js"`.

## Verification: code
