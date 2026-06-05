## Document ALLOW_DEV_AUTH in CONTEXT.md

`CONTEXT.md` still tells developers to run `pnpm run dev` with no auth env vars. The server dev script now prefixes `ALLOW_DEV_AUTH=1`, but the doc does not mention this or the alternative of setting `JWT_SECRET`.

### Acceptance Criteria

- `CONTEXT.md` "How to Run" section notes that `pnpm run dev` enables the insecure dev fallback via `ALLOW_DEV_AUTH=1` (set in `game/server/package.json`), or that operators can set `JWT_SECRET` instead.
- Example or env note matches the error message in `game/server/auth.js`.

## Assert ALLOW_DEV_AUTH in harness start_game unit test

`harness/tests/unit/test_game_start.py` checks that `start_game()` passes `PORT` in the server subprocess env but does not assert `ALLOW_DEV_AUTH=1`. A one-line assertion would prevent regressions of commit `ca7c6049`.

### Acceptance Criteria

- `TestServerLaunch::test_server_popen_args_env_and_pid` (or adjacent test) asserts `call["kwargs"]["env"]["ALLOW_DEV_AUTH"] == "1"`.
