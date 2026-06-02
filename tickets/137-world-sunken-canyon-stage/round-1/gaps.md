1. Captured run failed before gameplay: `metrics.json` reports `"ok": false` / `failure_kind: "capture_failed"`, and `/api/register` plus `/api/login` returned 502s from Vite proxy `ECONNREFUSED`.
   Files: game/client/vite.config.js, game/server/index.js
   Fix: make the capture/dev proxy reach the actual backend port used for the run, then re-run capture and confirm `metrics.json` is ok with no page errors.

2. Sunken-canyon enemies are assigned plateau/canyon X/Z bands but are not placed or rendered at the sampled floor Y, so the required plateau enemy is below the upper plateau in state/visuals.
   Files: game/server/progression.js, game/client/renderer.js
   Fix: set enemy `y` from `sampleFloorY(layout, x, z)` when spawning/updating enemies and render enemy meshes, hitboxes, lock-on rings, and telegraphs relative to that floor height.
