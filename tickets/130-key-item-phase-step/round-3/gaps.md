1. Round-3 live capture did not produce a clean browser run: `metrics.json` has `ok: false` / `failure_kind: "capture_failed"`, `console.log` is missing, and `screenshot.log` fails importing Playwright before capture.
   Files: none - harness/runtime environment, not game code.
   Fix: install or restore the harness Playwright dependency and rerun round-3 capture so metrics include a successful browser load with no pageerrors or fatal logs.
