# 10 — Re-run harness capture to prove game starts with ALLOW_DEV_AUTH=1

Round-4 capture failed (`metrics.json` `ok: false`) because the harness subprocess did not receive `ALLOW_DEV_AUTH=1` — likely a stale supervisor module cache. All code changes are complete and a fresh `capture_run()` with the current tree succeeds. This sub-ticket re-runs the capture from a clean harness process to produce passing proof artifacts.

## Acceptance Criteria

- A fresh `capture_run()` completes successfully:
  - `metrics.json` reports `"ok": true`
  - Server log contains `[auth] ... using dev fallback secret (ALLOW_DEV_AUTH=1)` (or equivalent dev-auth confirmation)
  - Server log shows `Server listening` on the game-server port
  - `pageerrors` is empty (no browser JS errors)
  - Screenshots are captured showing the game loaded in the browser
- No changes to `game/` source files are needed or made.

## Technical Specs

- No game code changes. Re-run the harness capture from a fresh `python3 -m harness` process.
- The `harness/steps/game.py` `start_game()` already sets `ALLOW_DEV_AUTH: "1"` in the Popen environment (line 219).
- The `harness/tests/unit/test_game_start.py` already asserts this env var is present.
- If capture still fails, diagnose why the pipeline subprocess did not receive `ALLOW_DEV_AUTH` (e.g., stale long-running supervisor module cache, env not propagated to child process).

## Verification: code
