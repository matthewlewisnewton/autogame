# Senior Review — 144-cleanup-harness-misclassifies-pageerror

This is a harness-cleanup ticket (three non-blocking nits carried over from
ticket 139). The ticket touches only `harness/` Python; the captured game run
is the smoke proof that the harness still drives a runnable game.

## Runtime health — PASS

From `round-1/metrics.json` and `round-1/console.log`:
- `metrics.json`: `ok: true`, `failure_kind: null`, `pageerrors: []`,
  `harness_failure: null`. Servers started; capture succeeded.
- `pageerrors.json`: `[]`.
- `console.log`: only benign noise — `[vite] connecting/connected`,
  `[initScene] Initializing Three.js scene...`, and two
  `Failed to load resource: ... 409 (Conflict)` lines. The 409s are tagged
  `[A:error]`/`[B:error]` (console-level, not `pageerror`/`fatal`) and are the
  usual dev-server session-create contention seen during parallel capture — no
  uncaught exception, no fatal from game code.

The game starts and loads cleanly. Runtime gate passes.

## Per-criterion findings

### AC1 — Stale `_read_harness_failure` docstring (commit `8d8f168`)
PASS. `harness/pipelines/ticket.py:94` now states the block is written **only**
when `_classify_capture_failure` diagnoses an infra signature (non-empty
`detected`), and that a bare `wait_for_game` timeout is classified as
`browser_pageerror`/`capture_failed` instead. `should_escalate_harness_failure`
(`ticket.py:113`) docstring now matches its `bool(infra_failure.get("detected"))`
gate. Both accurately describe current `capture_run` behavior.

### AC2 — Promote pageerrors when capture exits 0 (commit `77c76a7`)
PASS. `harness/steps/capture_run.py:128-144`: after a successful `capture()`,
`_read_pageerrors(dir)` is consulted; a non-empty list rewrites `metrics.json`
to `{ok: false, failure_kind: "browser_pageerror", pageerrors: [...]}` with no
`harness_failure` block, and `capture_run` returns `False`. Matches the AC
wording exactly. `_read_pageerrors` correctly prefers `pageerrors.json` and
falls back to `metrics.json.pageerrors`. The empty-pageerrors path still returns
`True` without clobbering the success metrics. Both behaviors are covered by new
regression tests in `TestCaptureSuccessPromotesPageerrors`.

### AC3 — `confirm_broken` classifies server-down (commit `fd1868c`)
PASS. `harness/steps/confirm_broken.py:56-65`: the `wait_for_game` failure path
now routes through `_classify_capture_failure(confirmation_dir, ports)`, so the
confirmation metrics carry `harness_failure` (infra) or `failure_kind:
"capture_failed"` (otherwise) instead of a bare
`{"ok": false, "error": "servers did not start"}`. `game_smoke_ok` still reads
both shapes as broken (both set `ok: false`, neither is `browser_pageerror`), so
`confirm_game_broken` still returns `True` for a server-down confirmation — no
behavior regression, only richer metrics for the smoke gate.

## Integration / quality
- The promote-pageerrors and classify paths are consistent with the existing
  `_classify_capture_failure` contract (all failure shapes set `ok: false`;
  only true infra sets `harness_failure`/`detected`).
- The lazy `from harness.steps.capture_run import _classify_capture_failure`
  inside `confirm_game_broken` matches the existing lazy-import style there and
  avoids any import cycle with `capture_run`.
- Tests: `tests/unit/test_capture_run_diagnostics.py` 37 passed; related
  confirm/smoke/escalate unit tests 14 passed. No regressions observed.

## Remaining gaps
None blocking. See `nits.md` for one minor follow-up (the promote path drops the
screenshots/probes arrays from the rewritten metrics — consistent with existing
classify behavior, not a regression).

VERDICT: PASS
