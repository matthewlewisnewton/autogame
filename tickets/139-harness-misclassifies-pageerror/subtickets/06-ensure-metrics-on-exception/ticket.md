# Ensure metrics.json is always written on capture failure

Round-1 capture timed out (Playwright subprocess 120s) and no `metrics.json` was produced, despite `capture_run.py` being designed to write classified metrics on any capture failure. The review notes: "which suggests either a write failure (e.g. permissions) or a pipeline gap worth fixing in a follow-up." The `capture()` function catches `TimeoutExpired` and returns `False`, but if an unexpected exception propagates from `capture()` or `_classify_capture_failure()`, the `metrics.json` write is skipped entirely.

Wrap the capture + classification in a try/except to guarantee `metrics.json` is always written, even on unexpected exceptions. Also set `CAPTURE_PLAN_AGENT=fallback` in the capture environment to avoid the blocking Gemini step that caused the 120s timeout.

## Acceptance Criteria

- `capture_run()` wraps the `capture()` call and `_classify_capture_failure()` in a try/except block so that `metrics.json` is ALWAYS written to disk before returning `False`, even if an unexpected exception occurs.
- On unexpected exception during capture, `metrics.json` contains `{"ok": false, "failure_kind": "capture_exception", "error": "<exception message>"}`.
- The `capture()` invocation in `screenshot.py` sets `CAPTURE_PLAN_AGENT=fallback` (via env) to skip the blocking Gemini capture-plan step and avoid 120s timeouts on tickets that don't need agent-guided capture.
- Existing behavior is preserved: clean servers + successful capture returns `True`; infra signatures produce `harness_failure`; page errors produce `browser_pageerror`.
- A new unit test verifies that an exception during capture still produces `metrics.json`.

## Technical Specs

- **File**: `harness/steps/capture_run.py`
  - In `capture_run()`, wrap the `capture()` call + classification in a try/except. In the except block, write `metrics.json` with `{"ok": false, "failure_kind": "capture_exception", "error": str(e)}`.
  - Alternatively, move the metrics write into a `finally` block guarded by a flag.
- **File**: `harness/steps/screenshot.py`
  - In `capture()`, pass `env={**os.environ, "CAPTURE_PLAN_AGENT": "fallback"}` to `subprocess.run()` to skip the Gemini capture-plan step.
- **File**: `harness/tests/unit/test_capture_run_diagnostics.py`
  - Add test `test_exception_during_capture_writes_metrics` that mocks `capture` to raise an exception and asserts `metrics.json` is written with `failure_kind == "capture_exception"`.

## Verification: code
