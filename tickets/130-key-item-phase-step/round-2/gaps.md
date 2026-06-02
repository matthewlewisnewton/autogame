1. Captured browser run did not complete, so there is no clean live-game proof: `metrics.json` has `"ok": false` / `"failure_kind": "capture_failed"`, and `screenshot.log` reports `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from harness/screenshot.mjs`.
   Files: none in `game/`; capture environment / `harness/screenshot.mjs`.
   Fix: restore/install the harness Playwright dependency and rerun capture; the ticket cannot pass until `metrics.json` is `ok: true` with no page errors.

2. `phase-step-ready` debug scenario fabricates the required co-op ally directly in `state.players`, so QA can exercise Phase Step without a real second connected lobby player.
   Files: `game/server/index.js`.
   Fix: remove or rework the scenario so it does not synthesize a co-op player; use a real second connected lobby participant for Phase Step validation, or limit the scenario to equipping/positioning the local player.
