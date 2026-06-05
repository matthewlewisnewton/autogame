# 08 — Assert ALLOW_DEV_AUTH in harness start_game unit test

`harness/tests/unit/test_game_start.py` checks that `start_game()` passes `PORT` in the server subprocess env but does not assert `ALLOW_DEV_AUTH=1`. A one-line assertion prevents regressions of the harness wiring (commit `ca7c6049`).

## Acceptance Criteria

- `TestServerLaunch::test_server_popen_args_env_and_pid` (or an adjacent test) asserts `call["kwargs"]["env"]["ALLOW_DEV_AUTH"] == "1"`.
- Existing test assertions for `PORT` remain unchanged and still pass.

## Technical Specs

- Edit `harness/tests/unit/test_game_start.py` — add an assertion that the mocked `Popen` call includes `ALLOW_DEV_AUTH: "1"` in the `env` dict.
- Run the harness unit tests to confirm the new assertion passes.

## Verification: code
