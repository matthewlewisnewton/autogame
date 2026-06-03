# Cleanup nits from 144-cleanup-harness-misclassifies-pageerror

> **Staleness note.** This follow-up ticket was written against commit
> `8d8f168` (2026-06-03). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `144-cleanup-harness-misclassifies-pageerror`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Promote-pageerrors path discards capture metadata

When `capture_run` promotes a successful capture to a `browser_pageerror`
failure (`harness/steps/capture_run.py:135-142`), it overwrites `metrics.json`
with a 3-key dict (`ok`, `failure_kind`, `pageerrors`), dropping the
`screenshots[]`, `probes`, `capturePlanSource`, and `scenarios` that the
successful `capture()` had just written. The reviewer prompt reads
`screenshots[]` to inspect the visual state, so a broken-with-pageerrors run
loses the very screenshots that show the breakage. This mirrors the existing
`_classify_capture_failure` behavior (so it is not a regression), but merging the
pageerror failure fields into the existing metrics instead of replacing them
would preserve the diagnostic context for the reviewer.

### Acceptance Criteria
- On the promote-pageerrors path, the rewritten `metrics.json` retains the
  `screenshots[]` (and other capture metadata) written by the successful
  `capture()` call, while setting `ok: false` and
  `failure_kind: "browser_pageerror"`.
- Existing regression tests in `TestCaptureSuccessPromotesPageerrors` still pass.
