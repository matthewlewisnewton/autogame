# Rename harness_failure to capture_diagnosis on capture_failed path

The `capture_failed` branch in `_classify_capture_failure()` still writes a `harness_failure` key when `detected` is empty and there are no page errors. This violates the top-level AC: "empty `detected` MUST NOT produce a `harness_failure` block." The key name `harness_failure` signals infrastructure failure to the reviewer, causing the same misclassification this ticket was created to fix.

Rename the diagnostic block to `capture_diagnosis` on the `capture_failed` path, reserving `harness_failure` exclusively for non-empty `detected` (actual infra failures). Update the unit test that currently asserts `harness_failure` with empty `detected`.

## Acceptance Criteria

- `_classify_capture_failure()` returns `capture_diagnosis` (NOT `harness_failure`) when `detected` is empty and `pageerrors` is empty. The returned dict has `{"ok": false, "failure_kind": "capture_failed", "capture_diagnosis": {...}}`.
- `harness_failure` key is present in the returned dict ONLY when `detected` is non-empty (infra signatures found).
- `harness/pipelines/ticket.py` functions (`_read_harness_failure`, `should_escalate_harness_failure`) continue to work correctly — they read `harness_failure` from metrics, which is now only present for real infra failures.
- Unit test `test_clean_servers_empty_pageerrors_harness_failure` is updated to assert `capture_diagnosis` instead of `harness_failure`, and renamed to reflect the new key.
- Unit test `test_no_infra_no_pageerrors_returns_capture_failed` is updated similarly.
- All 31+ existing tests continue to pass.

## Technical Specs

- **File**: `harness/steps/capture_run.py`
  - In `_classify_capture_failure()`, change the `else` branch from `"harness_failure": diagnosis` to `"capture_diagnosis": diagnosis`.
- **File**: `harness/tests/unit/test_capture_run_diagnostics.py`
  - `TestClassifyCaptureFailure.test_no_infra_no_pageerrors_returns_capture_failed`: change assertion from `"harness_failure" in result` to `"capture_diagnosis" in result`.
  - `TestBrowserPageerrorClassification.test_clean_servers_empty_pageerrors_harness_failure`: rename method to `test_clean_servers_empty_pageerrors_capture_diagnosis`, change assertions from `harness_failure` to `capture_diagnosis`.
  - `TestCaptureRunClassification.test_servers_up_capture_fail_no_pageerrors`: update assertion to check `capture_diagnosis` instead of `harness_failure`.
  - `TestGameSmokeOkBrowserPageerror.test_capture_failed_returns_false`: update synthetic metrics to use `capture_diagnosis` instead of `harness_failure` (cosmetic — the test logic checks `failure_kind`, not the key name, so this is optional but keeps test data consistent).

## Verification: code
