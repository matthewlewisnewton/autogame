1. Captured runtime proof is invalid: `metrics.json` reports `"ok": false` / `failure_kind: "capture_failed"`, browser `console.log` is missing, and `screenshot.log` failed with `Cannot find package 'playwright'`.
   Files: none - capture harness environment, not game code.
   Fix: restore/install the Playwright dependency used by `harness/screenshot.mjs`, rerun capture, and require clean metrics plus browser console proof before passing.

2. Registry-loaded enemy/minion models float above the floor because `normalizeLoadedRegistryModel()` grounds them at local y=0, then `attachRegistryModel()` adds them under hosts positioned at enemy half-height or minion y=0.5.
   Files: game/client/renderer.js
   Fix: attach registry models in a ground-level coordinate frame, or offset loaded models by the host's vertical placement so each model's bbox min.y lands at the entity floor while preserving procedural fallback placement.
