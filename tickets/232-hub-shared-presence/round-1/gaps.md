1. Captured game run does not load cleanly: `metrics.json` has `"ok": false`, Vite reports repeated `connect ECONNREFUSED 127.0.0.1:3003`/502s for backend and socket requests, and `screenshot.log` times out waiting for `#lobby` visibility.
   Files: game/server/index.js, game/client/main.js
   Fix: make the two-client browser capture reach the lobby with the backend remaining reachable on the configured port, then rerun capture so `metrics.json` is `"ok": true` with no page errors.
