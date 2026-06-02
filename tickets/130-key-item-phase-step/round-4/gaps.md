1. Round-4 capture did not complete, so there is no clean browser-load proof (`metrics.json` has `"ok": false`, `failure_kind: "capture_failed"`, and `console.log` is missing; `screenshot.log` reports `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'` from `harness/screenshot.mjs`).
   Files: none in `game/` - this is capture harness/dependency setup, not a Phase Step code path.
   Fix: restore/install the Playwright dependency used by `harness/screenshot.mjs`, rerun the round-4 capture, then re-review the resulting `metrics.json`, `console.log`, screenshots, probes, and page errors.
