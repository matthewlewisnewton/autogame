1. Captured game run does not load/run cleanly: `metrics.json` has `"ok": false` and `failure_kind: "capture_failed"`; `console.log` shows 502 socket resources and `client.log` shows repeated `ECONNREFUSED 127.0.0.1:3001` before timeout.
   Files: game/server/index.js, game/client/main.js
   Fix: Determine why the game server stops accepting socket proxy traffic during capture, keep the server alive/connected through lobby load, and re-run capture until `metrics.json` reports `"ok": true` with no page errors.
