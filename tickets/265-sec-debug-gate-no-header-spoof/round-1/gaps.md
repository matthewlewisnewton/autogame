1. Harness capture failed — game did not load cleanly in the browser (`metrics.json` `"ok": false`, `failure_kind: capture_failed`; Vite socket.io proxy `ECONNREFUSED`, HTTP 409/502, lobby wait timeouts; `pageerrors` empty).
   Files: none — harness infra / port-proxy lifecycle, not game code.
   Fix: Re-run round-1 capture after the harness operator clears port/proxy issues (ensure game server stays reachable on the port Vite proxies to for socket.io on :5177). Do NOT modify `game/` for this gap; code review and vitest already satisfy the ticket criteria.
