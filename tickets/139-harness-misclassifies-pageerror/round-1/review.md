# Senior review — ticket 139: harness misclassifies game pageerror as `harness_failure`

**Baseline:** `5eca7e9ce31c5364f2f2752be53b1be2b6a0b8ed`  
**Commits:** `f7bd7be` → `9a9fd83` (5 sub-tickets, harness-only; no `game/` changes)

## Runtime health (round-1 capture)

**FAIL — no runnable proof in round artifacts.**

| Check | Result |
|-------|--------|
| `round-1/metrics.json` | **Missing** |
| `round-1/console.log` | **Missing** |
| `round-1/client.log` | Present — Vite ready on :5173 |
| `round-1/server.log` | Present — server listening on :3000 |
| `pageerrors` / `failure_kind` | Cannot assess (no metrics) |

`log.txt` records the round-1 capture failure:

```text
[screenshot] failed: Command '['node', '.../harness/screenshot.mjs', 'http://localhost:5173', '.../round-1']' timed out after 119.9999889130122 seconds
```

`capture-plan-gemini.txt` contains only `spawnSync gemini ETIMEDOUT` — the agent-guided capture plan step hung/timed out before Playwright finished. Dev servers **did** start (log tails match the ticket-116 false-positive pattern: clean vite + server lines, no EADDRINUSE).

This is a **harness capture / tooling timeout**, not a game-code defect. There is still no `metrics.json` for the reviewer to consume; per review rules, that alone forces **FAIL** regardless of code quality.

**Note:** `capture_run.py` is written to emit a classified `metrics.json` when `capture()` returns `False` (including timeout). Round-1 has `screenshot.log` (0 bytes) and server logs but **no** `metrics.json`, which suggests either a write failure (e.g. permissions) or a pipeline gap worth fixing in a follow-up. Sub-ticket iteration artifacts (e.g. `subtickets/05-regression-tests/artifacts/iter-1/metrics.json`) show `ok: true` and `pageerrors: []` when capture completes, so the game itself was loading cleanly during implementation.

## Harness blockers

- **Signature:** Playwright capture subprocess timeout (120s); Gemini capture-plan `ETIMEDOUT`.
- **Evidence:** `tickets/139-harness-misclassifies-pageerror/log.txt` (~15:48:53); `round-1/capture-plan-gemini.txt`; absent `metrics.json` / `console.log`.
- **Not game code:** `client.log` / `server.log` show normal startup; no browser page errors captured.

Re-run round capture after the harness operator resolves the capture timeout (or temporarily uses fallback capture without a blocking Gemini plan step). **Do not** chase non-existent port leaks or `game/` import bugs for this round.

## Acceptance criteria

### 1. `harness_failure` only when infra `detected` is non-empty

**FAIL (code).** Top-level ticket requires: empty `detected` **must not** produce a `harness_failure` block.

`_classify_capture_failure()` in `harness/steps/capture_run.py` still emits `harness_failure` with `"detected": []` on the `capture_failed` branch (lines 106–112). Unit tests explicitly codify this (`test_no_infra_no_pageerrors_returns_capture_failed`, `test_clean_servers_empty_pageerrors_harness_failure`). That preserves log tails for investigation but **violates** the top-level AC and reintroduces the exact misclassification the ticket describes (reviewer sees `harness_failure` with empty `detected` and may blame infra).

**Mitigating but insufficient:** `should_escalate_harness_failure()` in `harness/pipelines/ticket.py` only escalates when `detected` is non-empty, so the round loop will not auto-bail to rescue on empty `detected`. The reviewer prompt still treats any `harness_failure` block as infra when `pageerrors` is empty.

**Fix direction:** On `capture_failed`, emit `failure_kind: "capture_failed"` plus a renamed diagnostic block (e.g. `capture_diagnosis`) with log tails and `port_holders`, **not** `harness_failure`. Reserve `harness_failure` for non-empty `detected` only.

### 2. Page errors captured to `console.log` / `pageerrors.json`

**PASS (code).** `harness/screenshot.mjs` wires `page.on('pageerror')`, logs `[tag:pageerror]` lines, and writes `pageerrors.json` with `{ message, sourceURL, line, column, stack }` in the `finally` block (lines 65–94, 804–806). Not exercised in round-1 (capture killed before `finally`).

### 3. `metrics.json`: `pageerrors`, `ok: false`, `failure_kind: "browser_pageerror"`

**PASS (code).** `capture_run._classify_capture_failure()` returns `failure_kind: "browser_pageerror"` and top-level `pageerrors` when `pageerrors` is non-empty and `detected` is empty; no `harness_failure` key on that path. Covered by unit tests and regression class `TestBrowserPageerrorClassification`.

### 4. Review prompt checks `pageerrors` before `harness_failure`

**PASS.** `harness/prompts/review.md` adds the pageerror-first flow, code-fix `gaps.md` examples, and infra section gated on empty `pageerrors`.

### 5. Per-iteration QA reads `console.log` / `pageerrors.json`

**PASS.** `harness/prompts/qa-code.md` adds a hard-fail browser pageerror check before acceptance criteria.

### 6. Regression test: clean servers + synthetic pageerror

**PASS.** `harness/tests/unit/test_capture_run_diagnostics.py` — 31 tests pass (`python3 -m pytest`). `test_clean_servers_pageerrors_no_harness_failure` asserts `failure_kind == "browser_pageerror"` and no `harness_failure`.

## Design / game regression

**N/A / PASS.** No `game/` changes. Sub-ticket captures reached lobby + gameplay with empty `pageerrors`. Consistent with `game/docs/design.md`; no debug scenarios added.

## Code quality

- Classification logic is clear and well-tested; infra-vs-code precedence (infra over pageerrors) is correct.
- `confirm_broken.game_smoke_ok()` correctly treats `browser_pageerror` as “servers up” for smoke gating while still failing review on page errors — intentional.
- **Stale docstring:** `_read_harness_failure()` in `ticket.py` still says the block is written whenever `wait_for_game` times out; behavior now depends on `capture_run` classification (nit).
- **Edge case (nit):** If `capture()` exits 0 but `metrics.json` contains non-empty `pageerrors`, `capture_run` returns `True` without promoting `failure_kind` (only classifies on capture failure).

## Debug scenarios

Not applicable — no new `?debugScenario=` shortcuts.

## Code merit (if capture had completed)

The core fix — collect page errors, classify `browser_pageerror` without `harness_failure`, update review/QA prompts, regression tests — would likely **pass** after fixing the empty-`detected` `harness_failure` emission. Round-1 capture timeout is orthogonal harness infra.

## Remaining gaps

1. **Round-1 capture incomplete** — no `metrics.json` or `console.log`; screenshot subprocess timed out at 120s (Gemini plan `ETIMEDOUT`). No proof of run for top-level review.
2. **`harness_failure` with empty `detected`** — `capture_failed` path still writes `harness_failure`; violates top-level AC and risks repeating ticket-116 reviewer misdirection.

VERDICT: FAIL
