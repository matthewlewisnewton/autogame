# Cleanup nits from 139-harness-misclassifies-pageerror

> **Staleness note.** This follow-up ticket was written against commit
> `562cfb8` (2026-05-31). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `139-harness-misclassifies-pageerror`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stale _read_harness_failure docstring

`harness/pipelines/ticket.py::_read_harness_failure` still documents that the block is written whenever `wait_for_game` times out. After ticket 139, `capture_run._classify_capture_failure()` only writes `harness_failure` when infra signatures are detected in `detected`.

### Acceptance Criteria
- Update the docstring to describe current `capture_run` classification and `should_escalate_harness_failure` gating accurately.

## Promote pageerrors when capture exits 0

If Playwright capture exits 0 (screenshots captured) but `metrics.json` contains a non-empty `pageerrors` array, `capture_run` returns success without setting `ok: false` or `failure_kind: "browser_pageerror"`. Review and QA prompts still catch non-empty `pageerrors`, but metrics semantics are inconsistent with the AC wording.

### Acceptance Criteria
- After a successful `capture()` return, read `pageerrors.json` or `metrics.json.pageerrors`; if non-empty, rewrite metrics with `ok: false` and `failure_kind: "browser_pageerror"` (no `harness_failure` unless `detected` is non-empty).

## confirm_broken uses unclassified server-down metrics

`confirm_game_broken()` still writes bare `{"ok": false, "error": "servers did not start"}` when confirmation capture times out on server startup, without running `_classify_capture_failure()`.

### Acceptance Criteria
- When the confirmation run's servers fail to start, classify via `_classify_capture_failure()` so empty-`detected` runs do not leave ambiguous metrics for the smoke gate.
