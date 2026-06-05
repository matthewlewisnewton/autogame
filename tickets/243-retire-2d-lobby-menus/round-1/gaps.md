1. Captured run does not complete cleanly: `metrics.json` has `"ok": false` / `failure_kind: "capture_failed"`, and `console.log` ends with `page.waitForFunction: Timeout 12000ms exceeded` while still in the squad lobby.
   Files: `game/client/main.js`, `game/client/launchBooth.js`
   Fix: Make the deterministic launch proof work after retiring the 2D Deploy button by driving the existing Launch Bay ready-up path (`?booth=launch` or equivalent booth interaction), then re-run until metrics are `ok: true` and the run reaches the playing phase.
