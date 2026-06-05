1. Captured run did not load cleanly: `metrics.json` reports `"ok": false` / `failure_kind: "capture_failed"`, with repeated 502s and `ECONNREFUSED 127.0.0.1:3003` for auth/socket requests.
   Files: game/client/vite.config.js, game/server/index.js
   Fix: Make the dev/harness startup keep the game server reachable before browser auth/socket traffic, then rerun capture until `metrics.json` is `ok: true` with no page errors or fatal logs.

2. `arena-trials-tier-2` debug scenario starts a run before selecting Arena Trials Tier 2, so `spawnEnemy()` reads stale `run.questTier` and does not faithfully exercise Tier 2 variant rolls/run metadata.
   Files: game/server/debugScenarios.js, game/server/index.js, game/server/progression.js
   Fix: Set Arena Trials Tier 2 before entering playing phase, or recreate/update the run after selection so `run.questId`, `run.questTier`, objective state, layout, and spawned variants match normal Tier 2 deployment.
