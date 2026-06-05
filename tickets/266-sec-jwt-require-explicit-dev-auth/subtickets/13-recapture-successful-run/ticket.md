# 13-recapture-successful-run

Re-run the harness capture to produce a passing `metrics.json` (`ok: true`) with screenshots and server log showing the game starts correctly with `ALLOW_DEV_AUTH=1`. Round-8 capture failed because the subprocess didn't receive the env var despite correct source wiring — code is fine, just need a clean capture from a fresh harness process.

## Acceptance Criteria

- A fresh `capture_run()` completes with `metrics.json` reporting `"ok": true`
- Server log shows `[auth] JWT_SECRET not set — using dev fallback secret (ALLOW_DEV_AUTH=1)` and `Server listening`
- Screenshots are present in the capture artifacts
- No `game/` files are modified — this is a harness re-run only

## Technical Specs

No code changes. Run `python3 -m harness` from a fresh process to trigger `start_game()` which sets `ALLOW_DEV_AUTH=1` in the server Popen env (verified at `harness/steps/game.py:219`).

## Verification: code
