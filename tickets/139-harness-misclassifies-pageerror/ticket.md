# Fix: harness misclassifies game pageerror as `harness_failure` infra issue

When the captured browser run errors out at module load (a real game bug —
e.g. ticket 138's `does not provide an export named 'DEFAULT_FLOOR_Y'`),
the harness writes a `harness_failure` block in `metrics.json` and the
top-level reviewer dutifully attributes the failure to **infrastructure**
(port leak, foreign holder) instead of to the **code**. The next round's
`gaps.md` then says "re-run capture after the harness operator clears the
port leak; do NOT modify game/" — pushing the fix away from where it
actually belongs.

This was directly observed on 2026-05-30 to 2026-05-31 during ticket 116
rounds 3-4: the dev servers DID start cleanly (vite log:
`VITE v8.0.13 ready in 99 ms`, server log: `Server listening on port 3000`,
`port_holders` shows our own PIDs), but the page itself was broken because
of the ticket-138 import bug. The harness still wrote `harness_failure`,
and the rounds-loop kept churning on non-existent infra problems.

## Difficulty: medium

## Goal

When `capture_run` fails to produce a useful console.log / screenshot
because the **browser** errored at module-load time, the harness must
classify the failure as a **code defect**, surface the page errors to the
reviewer, and write `gaps.md` content that points at the offending
filename and import.

## Problem

`harness/steps/capture_run.py` (or wherever `capture_run` derives the
`harness_failure` block) currently bundles "vite/node servers didn't bind"
AND "playwright couldn't get a usable page" into the same `harness_failure`
bucket. The two failure modes need different handling:

- **Real infra failure** (current behaviour): vite EADDRINUSE, port held
  by foreign holder, server exited rc≠0. Reviewer correctly says "fix
  infra, don't touch code".
- **Code failure dressed as infra** (current bug): vite + server BOTH
  start fine (their logs in `metrics.json.harness_failure.client_log_tail`
  / `server_log_tail` show clean startup), but the page produced
  `pageerror` events. The harness ignored these and still emitted
  `harness_failure`, misdirecting the reviewer.

Evidence from round-3 of 116 on 2026-05-31 (captured in
`tickets/116-sloped-floor-layout-and-geometry/round-3/metrics.json`):

```json
"harness_failure": {
  "detected": [],
  "client_log_tail": "VITE v8.0.13 ready in 99 ms\n...",
  "server_log_tail": "Server listening on port 3000",
  "port_holders": { "5173": [our pid], "3000": [our pid] }
}
```

`detected: []` means no infra signature matched (no EADDRINUSE), and the
log tails show clean startup, yet `harness_failure` was still set, and
the round-3 `gaps.md` said:

> 1. Harness failed to start dev servers (ports 5173 and 3000 already
>    held by stale `vite` / `node game/server/index.js` processes).
>    Fix: re-run capture after the harness operator clears the port leak;
>    do NOT modify game/.

…which was **wrong**: the dev servers started fine; the **page** broke.

## Acceptance Criteria

- `metrics.json.harness_failure` is set ONLY when an actual infra
  signature is detected: non-empty `detected` array (e.g.
  `vite_eaddrinuse`, `server_did_not_listen`, `port_held_by_foreign_pid`,
  `vite_exit_nonzero`, `server_exit_nonzero`). Empty `detected` MUST
  NOT produce a `harness_failure` block.
- When the dev servers start cleanly but the playwright capture sees
  `page.on('pageerror', …)` or an `Uncaught` console error, the harness:
  - **Captures the page errors** to
    `tickets/<ticket>/round-<N>/console.log` and/or `pageerrors.json`,
    with line/column/stack where available.
  - Adds a top-level `pageerrors` array to `metrics.json` with at least
    `{ message, sourceURL, line }` per error, including the first 10
    such errors.
  - Sets `metrics.json.ok = false` and `metrics.json.failure_kind =
    "browser_pageerror"` (distinct from `harness_failure`).
- The top-level review prompt's "FIRST — CONFIRM THE GAME ACTUALLY RUNS"
  check (currently in `harness/prompts/review.md`) is updated so the
  reviewer reads `metrics.json.pageerrors` and `console.log` for
  pageerror lines BEFORE checking `harness_failure`. If `pageerrors`
  is non-empty:
  - The verdict is `FAIL` (same as today),
  - But `gaps.md` lists the **page errors with file:line and the suspected
    cause**, NOT an infra blocker. E.g.:
    > 1. Browser pageerror at module load: `The requested module
    >    '/@fs/.../game/shared/floorSampling.js' does not provide an
    >    export named 'DEFAULT_FLOOR_Y'`. Files: `game/shared/
    >    floorSampling.js`, `game/client/collision.js`. Fix: <…>.
- Per-iteration QA (the qwen subticket QA, not just the top-level
  reviewer) is also updated to surface page errors. Today subticket QA
  reads `local-checks.log` + diff; it should also read
  `console.log`/`pageerrors.json` when present and fail the iteration
  on a non-empty pageerror list, even if the diff looks fine.
- Regression test: extend `harness/tests/unit/test_capture_run_diagnostics.py`
  with a case where the dev servers start cleanly (mocked) but the
  capture step produces a synthetic `pageerror` — assert the resulting
  `metrics.json` has `failure_kind == "browser_pageerror"` and NO
  `harness_failure` block.

## Technical Specs

- **Files** (most likely — verify with `grep -rn harness_failure
  harness/`):
  - `harness/steps/capture_run.py` — the place `harness_failure` is
    emitted. Add the `pageerrors` collection and the `failure_kind`
    discriminator.
  - `harness/screenshot.mjs` — wire the playwright `pageerror` listener
    to write a small `pageerrors.json` alongside `console.log` (or extend
    `console.log` with `[pageerror]` lines).
  - `harness/prompts/review.md` — update the "FIRST — CONFIRM THE GAME
    ACTUALLY RUNS" block so it checks `pageerrors` and writes a
    code-fix `gaps.md` when present.
  - `harness/prompts/qa-code.md` — same extension for per-iteration QA.
  - `harness/tests/unit/test_capture_run_diagnostics.py` — extend
    coverage as above.

- **The discriminator**:
  - `harness_failure` ← infra (servers didn't start, signatures detected).
  - `failure_kind: "browser_pageerror"` ← code (servers OK, browser had
    errors).
  - `failure_kind: "no_canvas"` etc. could be added as needed.
  - Both produce `ok: false`, but they steer rescue / next-round work to
    different places.

- **What to test in unit tests**:
  - Both clean-servers + non-empty pageerror list → no `harness_failure`,
    `failure_kind == "browser_pageerror"`.
  - Servers EADDRINUSE → `harness_failure.detected` includes
    `vite_eaddrinuse`, NO `failure_kind` of code type.
  - Both clean-servers + empty pageerror + missing canvas → maybe
    `failure_kind: "no_canvas"` (or keep behaviour for this round and
    add a TODO).

- **Don't regress the existing infra path.** The round-1 → round-3 of
  116 also legitimately hit `vite_eaddrinuse` because of orphan vite
  processes; commits `041eef8` (game.py fix) and `03da146` (rescue.py
  fix) handled that. The new code path must preserve the infra detection
  behaviour exactly when `detected` is non-empty.

## Verification: code

(QA reads the new tests + the harness/ diff. There is no game-side change
to verify visually.)

## Notes

- Discovered alongside ticket 138 during manual probing on 2026-05-31.
  The combination of 138 + 139 is what caused ticket 116 to churn rounds
  2–4+ with no progress: 138 broke the game, 139 hid that fact from the
  reviewer, and the reviewer pushed the blame at non-existent infra.
- The harness's per-iteration QA was ALSO blind: subticket 05 + 06 both
  passed QA despite the bug because code-mode QA reads diffs/logs and
  never noticed the browser couldn't load. Extending QA to read
  `console.log` for pageerrors closes that gap.
- Long-term, consider a `pnpm dev:probe` script the harness can run that
  literally `curl -fsS localhost:5173/` AND opens a headless playwright
  + checks for pageerrors as part of `local-checks`. That would catch
  138-class bugs even before the top-level review fires.
