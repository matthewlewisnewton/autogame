1. Captured game run did not load cleanly: `metrics.json` has `"ok": false` / `failure_kind: "capture_failed"`, `console.log` shows Vite 502s for `/api/register` and `/api/login`, and `screenshot.log` timed out before the lobby appeared.
   Files: game/client/vite.config.js, game/server/index.js, tickets/137-world-sunken-canyon-stage/round-1/metrics.json
   Fix: make the capture start client and server with matching backend proxy port (or adjust proxy/startup wiring), then rerun capture until `metrics.json` is `"ok": true` with no auth 502s.
