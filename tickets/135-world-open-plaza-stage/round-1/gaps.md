1. Captured run did not produce runnable browser proof: `metrics.json` has `"ok": false` / `failure_kind: "capture_failed"` and `console.log` is absent because `harness/screenshot.mjs` could not import `playwright`.
   Files: none in `game/` identified; capture failure is in the harness/dependency environment.
   Fix: install/restore the Playwright dependency used by the screenshot harness and rerun capture; only modify `game/` if the rerun reports a game pageerror or fatal console error.
