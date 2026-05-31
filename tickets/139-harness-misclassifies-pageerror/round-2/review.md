# Senior review — ticket 139: harness misclassifies game pageerror as `harness_failure`

**Baseline:** `5eca7e9ce31c5364f2f2752be53b1be2b6a0b8ed`  
**Commits:** `f7bd7be` → `562cfb8` (7 sub-tickets, harness-only; no `game/` changes)

## Runtime health (round-2 capture)

**PASS — game starts and loads cleanly.**

| Check | Result |
|-------|--------|
| `round-2/metrics.json` | Present — `"ok": true` |
| `round-2/pageerrors` | Empty array `[]` |
| `failure_kind` | Absent (success path) |
| `harness_failure` | Absent |
| `round-2/console.log` | Clean — Vite connect + `[initScene]` only; no `[pageerror]` or `[fatal]` lines |
| `round-2/pageerrors.json` | `[]` |
| `round-2/client.log` | Vite ready on :5173; benign THREE.Clock deprecation + EPIPE on ws close (ignored) |
| `round-2/server.log` | Server listening on :3000; normal lobby/dungeon flow |

Capture reached lobby and gameplay (`01-lobby.png`, `02-gameplay.png`). Probes show `phase: "playing"`, `hasCanvas: true`, `sceneInitialized: true`, 5 enemies, card hand visible — consistent with a healthy run.

Round-1 gaps (missing `metrics.json`, empty-`detected` `harness_failure`) are resolved in round-2.

## Acceptance criteria

### 1. `harness_failure` only when infra `detected` is non-empty

**PASS.** `_classify_capture_failure()` in `harness/steps/capture_run.py` emits `harness_failure` only when `detected` is non-empty (lines 92–98). When servers start but capture fails with no infra signature and no page errors, it writes `failure_kind: "capture_failed"` with a `capture_diagnosis` block (not `harness_failure`) — fixing the round-1 violation. `should_escalate_harness_failure()` in `harness/pipelines/ticket.py` gates escalation on non-empty `detected`. Regression tests `test_no_infra_no_pageerrors_returns_capture_failed` and `test_clean_servers_empty_pageerrors_capture_diagnosis` assert this.

### 2. Page errors captured to `console.log` / `pageerrors.json`

**PASS.** `harness/screenshot.mjs` collects structured page errors via `page.on('pageerror')`, logs `[tag:pageerror]` lines to `console.log`, and writes `pageerrors.json` with `{ message, sourceURL, line, column, stack }` in the `finally` block. Round-2 artifacts confirm both files are written on successful capture.

### 3. `metrics.json`: `pageerrors`, `ok: false`, `failure_kind: "browser_pageerror"`

**PASS.** When capture fails and page errors exist with no infra signature, `_classify_capture_failure()` returns `ok: false`, `failure_kind: "browser_pageerror"`, and a top-level `pageerrors` array — no `harness_failure` key. `screenshot.mjs` also embeds `pageerrors` (first 10) in `metrics.json` on every run. Covered by `test_pageerrors_no_infra_returns_browser_pageerror`, `test_servers_up_capture_fail_with_pageerrors`, and `test_clean_servers_pageerrors_no_harness_failure`.

### 4. Review prompt checks `pageerrors` before `harness_failure`

**PASS.** `harness/prompts/review.md` adds pageerror checks to the runtime-health gate, a dedicated "BROWSER PAGE ERRORS — CODE DEFECT, NOT INFRA" section with code-fix `gaps.md` examples, and gates the infra section on empty/absent `pageerrors`.

### 5. Per-iteration QA reads `console.log` / `pageerrors.json`

**PASS.** `harness/prompts/qa-code.md` references `pageerrors.json` and `metrics.json.pageerrors`, with a hard-fail browser pageerror check (grep `[pageerror]`) before acceptance criteria.

### 6. Regression test: clean servers + synthetic pageerror

**PASS.** `harness/tests/unit/test_capture_run_diagnostics.py` — **34 tests pass** (`python3 -m pytest`). `test_clean_servers_pageerrors_no_harness_failure` asserts `failure_kind == "browser_pageerror"` and no `harness_failure`. EADDRINUSE path preserved in `test_eaddrinuse_harness_failure_signatures`.

## Design / game regression

**N/A / PASS.** No `game/` changes. Round-2 capture exercised standard lobby-to-dungeon flow with empty `pageerrors`. Consistent with `game/docs/design.md`; no debug scenarios added or modified.

## Code quality

- Three-way classification (`harness_failure` / `browser_pageerror` / `capture_failed`) is clear, well-tested, and preserves infra-over-pageerror precedence.
- Sub-ticket 06 adds exception handling so `capture_run` always writes classified `metrics.json` on unexpected failures (`failure_kind: "capture_exception"`).
- `confirm_broken.game_smoke_ok()` correctly treats `browser_pageerror` as "servers up" for smoke gating while review/QA still hard-fail on page errors.
- Infra signature detection unchanged from baseline (`vite_eaddrinuse`, `server_eaddrinuse`); existing EADDRINUSE rescue path preserved.

## Debug scenarios

Not applicable — no new or changed `?debugScenario=` shortcuts in this ticket.

## Remaining gaps

None. Round-2 capture provides runnable proof; all acceptance criteria are met in the current codebase.

VERDICT: PASS
