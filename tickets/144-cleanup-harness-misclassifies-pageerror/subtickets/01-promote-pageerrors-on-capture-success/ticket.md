# Promote pageerrors when capture exits 0

When Playwright `capture()` returns success but the run recorded a non-empty
`pageerrors` array, `capture_run` currently returns `True` without ever
marking the metrics as a failure. Make a successful capture re-check
`pageerrors` and re-classify the run as a `browser_pageerror` failure so the
metrics semantics match the review/QA prompts.

## Acceptance Criteria
- In `capture_run`, after `capture(...)` returns `capture_ok == True`, read the
  page errors via the existing `_read_pageerrors(dir)` helper (which already
  checks `pageerrors.json` then `metrics.json.pageerrors`).
- If the page-error list is non-empty, write `metrics.json` with
  `ok: false` and `failure_kind: "browser_pageerror"` (and the `pageerrors`
  list), then return `False`.
- The promoted metrics must NOT contain a `harness_failure` block (that block is
  only for infra signatures, i.e. non-empty `detected`).
- If the page-error list is empty, `capture_run` still returns `True` and does
  not overwrite a freshly captured `metrics.json` with a failure.
- A unit test exercises the "capture succeeds but pageerrors non-empty" path and
  asserts the resulting `metrics.json` has `ok == False` and
  `failure_kind == "browser_pageerror"`.

## Technical Specs
- `harness/steps/capture_run.py`: in `capture_run`, change the
  `if capture_ok: return True` branch (around lines 126-129) to first call
  `_read_pageerrors(dir)`. When non-empty, build a metrics dict
  `{"ok": False, "failure_kind": "browser_pageerror", "pageerrors": [...]}`
  and write it to `dir / "metrics.json"` (json.dumps with `indent=2` + newline,
  matching the existing writes), then `return False`. Reuse the existing
  `_classify_capture_failure` shape for the `browser_pageerror` case — but note
  that on the capture-success path the servers are known up, so do NOT run the
  infra `_diagnose_servers_did_not_start` scan; just emit the
  `browser_pageerror` metrics directly.
- `harness/tests/unit/test_capture_run_diagnostics.py`: add a test for the new
  promotion path (you may need to stub/monkeypatch `capture`, `start_game`,
  `stop_game`, and `wait_for_game` so `capture_run` reaches the success branch
  with a `pageerrors.json` present).

## Verification: code
