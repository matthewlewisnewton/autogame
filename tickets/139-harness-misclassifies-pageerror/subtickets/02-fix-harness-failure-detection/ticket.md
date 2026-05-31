# Only emit harness_failure for real infra; add browser_pageerror failure kind

`capture_run.py` currently writes a `harness_failure` block whenever `wait_for_game` times out, even when both dev servers started cleanly. This causes the reviewer to misattribute browser-side code defects (module-load errors) as infrastructure problems. The fix: only emit `harness_failure` when infra signatures are actually detected, and introduce a `browser_pageerror` failure kind for code defects.

## Acceptance Criteria

- `capture_run()` checks the result of `capture()` (the screenshot step). When `capture()` returns `False` or `metrics.json` has `"ok": false`:
  - If `_diagnose_servers_did_not_start` finds non-empty `detected` → write `harness_failure` block (existing behavior, no change).
  - If `detected` is empty AND `pageerrors` is non-empty (from `pageerrors.json` or `metrics.json.pageerrors`) → write `{"ok": false, "failure_kind": "browser_pageerror", "pageerrors": [...]}` with NO `harness_failure` key.
  - If `detected` is empty AND `pageerrors` is empty → write `{"ok": false, "failure_kind": "capture_failed", "harness_failure": {...}}` (diagnose block for investigation).
- When servers start cleanly AND capture succeeds → existing behavior (metrics.json with `"ok": true`), no change.
- `harness_failure` is NEVER written when `detected` is empty and pageerrors are non-empty.
- The `browser_pageerror` failure kind includes the page errors array so the reviewer can extract file:line info.

## Technical Specs

- **File**: `harness/steps/capture_run.py`
- In `capture_run()`, after `capture(game_url, dir)`:
  - Read back `metrics.json` from the capture step to check `"ok"` and `"pageerrors"`.
  - If `ok` is `False`, read `pageerrors.json` (or `metrics.json.pageerrors`) to determine failure kind.
  - Branch: non-empty `detected` → `harness_failure`; non-empty `pageerrors` → `browser_pageerror`; else → generic `capture_failed` with diagnosis block.
- Helper function `_classify_capture_failure(dir, ports)` that:
  1. Runs `_diagnose_servers_did_not_start(dir, ports)` to get `detected`.
  2. Reads `pageerrors.json` or `metrics.json` for page errors.
  3. Returns the appropriate metrics dict based on the discriminator rules above.
- Also update `harness/steps/confirm_broken.py::game_smoke_ok()` — currently it returns `False` when `metrics.json` has `"ok": false`. It should also check for `failure_kind == "browser_pageerror"` (which is a code defect, not a smoke failure of infra).

## Verification: code
