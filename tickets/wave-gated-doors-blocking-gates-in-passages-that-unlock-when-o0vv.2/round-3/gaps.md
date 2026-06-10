1. Captured game does not load cleanly: `metrics.json` reports `"ok": false` / `failure_kind: "capture_failed"`, and `console.log` shows `page.goto: Page crashed` before any screenshots or probes.
   Files: game/client/main.js, game/client/renderer.js
   Fix: Reproduce the browser navigation crash in the client startup/render path and fix it so the round capture reaches a loaded game with `metrics.json` `"ok": true`.
