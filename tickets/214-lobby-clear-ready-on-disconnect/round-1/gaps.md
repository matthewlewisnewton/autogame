1. Harness capture failed: Vite on :5175 proxied to the wrong backend port (default 3000) while the game server listened on 3002, causing ECONNREFUSED on /api and /socket.io and a capture timeout (`metrics.json` `"ok": false`, `"failure_kind": "capture_failed"`).
   Files: none — this is harness infra, not game code.
   Fix: re-run capture with `HARNESS_GAME_PORT=3002` (or the allocated port) passed to the Vite client process so the proxy matches the started server; do NOT modify game/ for this failure.
