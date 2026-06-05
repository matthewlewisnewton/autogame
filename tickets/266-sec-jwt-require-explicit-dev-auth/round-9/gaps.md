1. Uncommitted harness-detection fallback in `initAuth()` grants `dev-secret` without `ALLOW_DEV_AUTH=1` when `!process.stdout.isTTY && PORT` is a non-default integer — reopening the staging/PaaS auth bypass this ticket closes (verified: `NODE_ENV=staging PORT=8080 !isTTY` → `dev-secret`).
   Files: `game/server/auth.js` (delete lines 77–93), `game/server/test/auth.test.js` (delete harness-detection tests at lines 376–412)
   Fix: Remove the `!isTTY + non-default PORT` block and its three tests. Do not commit or keep any implicit dev-secret path other than `ALLOW_DEV_AUTH=1` (and `NODE_ENV=test`). Revert to the committed HEAD behavior for `initAuth()`.

2. Round-9 capture started the server via harness-detection fallback, not `ALLOW_DEV_AUTH=1` — server.log line 4 shows `harness-detected: PORT=3004, !isTTY` despite `harness/steps/game.py:219` setting the env var.
   Files: `harness/steps/game.py` (source wiring is correct; diagnose propagation), no further `game/` bypass
   Fix: After gap 1 is fixed, re-run capture from a fresh `python3 -m harness` process and confirm server.log shows `[auth] … using dev fallback secret (ALLOW_DEV_AUTH=1)`, not `harness-detected`. Do not add game-code workarounds for env propagation failures.
