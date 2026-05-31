## Stale _read_harness_failure docstring

`harness/pipelines/ticket.py::_read_harness_failure` still documents that the block is written whenever `wait_for_game` times out. After ticket 139, `capture_run` classifies failures and only writes `harness_failure` for infra signatures or the legacy capture_failed path.

### Acceptance Criteria
- Update the docstring to describe current `capture_run` / `should_escalate_harness_failure` behavior accurately.

## Promote pageerrors when capture exits 0

If Playwright capture exits 0 but `metrics.json` contains a non-empty `pageerrors` array, `capture_run` returns success without setting `failure_kind: browser_pageerror`.

### Acceptance Criteria
- After a successful `capture()` return, read `metrics.json.pageerrors` (or `pageerrors.json`) and if non-empty, rewrite metrics with `ok: false` and `failure_kind: browser_pageerror` (no `harness_failure` unless `detected` is non-empty).

## Round capture timeout should still leave classified metrics

Round-1 had a screenshot timeout but no `metrics.json`, even though `capture_run` should classify failures when `capture()` returns False.

### Acceptance Criteria
- Add a unit or integration test that mocks `capture()` raising `subprocess.TimeoutExpired` and asserts `metrics.json` is written with `failure_kind: capture_failed` (or appropriate kind) in the artifacts dir.
