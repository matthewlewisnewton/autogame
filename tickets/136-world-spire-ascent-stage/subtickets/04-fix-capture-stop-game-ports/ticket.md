# Fix capture_run scoped stop_game to prevent mid-capture server kill

Round-1 review failed with `capture_failed`: the game server on `:3001` was gone
while Vite on `:5174` still ran, producing client `ECONNREFUSED` / `502` and a
`waitForFunction` timeout. `capture_run()` calls `stop_game()` in its `finally`
block without passing `ports`, which triggers a blanket `pkill` on every
`game/server/index.js` process and can kill a sibling worker's server mid-capture.

## Acceptance Criteria

- `capture_run()` passes the same `PortAllocation` to `stop_game(ports)` in the
  `finally` block (not bare `stop_game()`).
- A unit test in `harness/tests/unit/test_capture_run_diagnostics.py` asserts
  that `stop_game` is invoked with the worker's `ports` when capture completes or
  fails (monkeypatch `stop_game` and inspect call args).
- `pytest harness/tests/unit/test_capture_run_diagnostics.py` passes.
- No files under `game/` are modified.

## Technical Specs

- **`harness/steps/capture_run.py`**: change the `finally` clause from
  `stop_game()` to `stop_game(ports)`. This matches the parallel-worker contract
  documented in `stop_game()` — when `ports` is provided, only that worker's
  Vite port is reclaimed via `pkill`; the blanket `server/index.js` kill is
  skipped so sibling captures keep their servers alive.
- **`harness/tests/unit/test_capture_run_diagnostics.py`**: add
  `test_capture_run_passes_ports_to_stop_game` — monkeypatch `start_game`,
  `wait_for_game`, `capture`, and `stop_game`; run `capture_run(..., ports=...)`
  and assert `stop_game` was called once with the same `ports` instance.

## Verification: code
