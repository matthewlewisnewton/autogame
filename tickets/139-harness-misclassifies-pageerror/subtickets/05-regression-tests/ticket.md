# Regression tests for pageerror classification

Add unit tests to `harness/tests/unit/test_capture_run_diagnostics.py` to verify that the new pageerror classification path works correctly and the existing infra-detection path is not regressed.

## Acceptance Criteria

- A new test class `TestBrowserPageerrorClassification` exists with at least 3 tests:
  1. **Clean servers + non-empty pageerrors → no harness_failure, failure_kind == "browser_pageerror"**: Mock `wait_for_game` to return `True`, `capture` to write `metrics.json` with `"ok": false` and a non-empty `pageerrors` array. Assert the resulting `metrics.json` has `failure_kind == "browser_pageerror"` and NO `harness_failure` key.
  2. **Servers EADDRINUSE → harness_failure with detected signatures**: Mock `wait_for_game` to return `False` with EADDRINUSE in logs. Assert `harness_failure.detected` includes `vite_eaddrinuse` and NO `failure_kind` of code type.
  3. **Clean servers + empty pageerrors + capture failure → harness_failure for investigation**: Mock `wait_for_game` to return `True`, `capture` to write `metrics.json` with `"ok": false` and empty/absent `pageerrors`. Assert `harness_failure` is present with empty `detected` (for human investigation).
- All existing tests in `TestDiagnoseServersDidNotStart` and `TestTicketPipelineDetectsAndEscalates` continue to pass (no regression).
- Tests run via `cd game && pnpm test` (or `pytest harness/tests/unit/test_capture_run_diagnostics.py`).

## Technical Specs

- **File**: `harness/tests/unit/test_capture_run_diagnostics.py`
- New test class `TestBrowserPageerrorClassification`:
  - Use `monkeypatch` to mock `start_game`, `wait_for_game`, `stop_game`, `_port_holders`.
  - For the pageerror test: mock `capture` to write a `metrics.json` with `{"ok": false, "pageerrors": [{"message": "...", "sourceURL": "..."}]}`.
  - For the EADDRINUSE test: write `client.log` with EADDRINUSE, mock `wait_for_game` to return `False`.
  - For the generic failure test: mock `capture` to write `{"ok": false}` with no pageerrors.
- Use the same `tmp_artifacts` fixture pattern as existing tests.

## Verification: code
