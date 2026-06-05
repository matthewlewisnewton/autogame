1. Captured run did not load cleanly: `metrics.json` reports `"ok": false` / `failure_kind: "capture_failed"`, `screenshot.log` timed out, and `console.log`/`client.log` show repeated `/socket.io` 502 proxy failures with `ECONNREFUSED`.
   Files: `game/client` dev proxy/socket setup, `game/server/index.js`
   Fix: make the dev capture start and keep the Socket.IO backend reachable through Vite, then rerun capture until `metrics.json` is `ok: true` with no page errors.
