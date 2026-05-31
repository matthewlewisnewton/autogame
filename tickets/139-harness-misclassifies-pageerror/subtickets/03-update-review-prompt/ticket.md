# Update review prompt to check pageerrors before harness_failure

The review prompt (`harness/prompts/review.md`) currently checks `harness_failure` to decide whether a failure is infrastructure vs code. With the new `browser_pageerror` failure kind and `pageerrors` array in `metrics.json`, the prompt must check page errors **before** `harness_failure` and produce code-fix gaps (not infra gaps) when page errors are present.

## Acceptance Criteria

- The "FIRST — CONFIRM THE GAME ACTUALLY RUNS" section is updated to check `metrics.json.pageerrors` (and `console.log` for `[pageerror]` lines) **before** checking `harness_failure`.
- When `pageerrors` is non-empty (or `failure_kind == "browser_pageerror"`):
  - The verdict is `VERDICT: FAIL` (same as today).
  - The reviewer writes a **code-fix** gap in `__GAPS_OUT__`, quoting the page error message, sourceURL, and line number — NOT an infra blocker.
  - Example gap format: `1. Browser pageerror at module load: "The requested module '...' does not provide an export named 'DEFAULT_FLOOR_Y'". Files: game/shared/floorSampling.js, game/client/collision.js. Fix: ...`
- The existing "HARNESS INFRASTRUCTURE FAILURE" section is preserved but only applies when `harness_failure` is present AND `pageerrors` is empty/absent.
- The prompt explicitly states: if `pageerrors` is non-empty, this is a **code defect**, not a harness bug.

## Technical Specs

- **File**: `harness/prompts/review.md`
- Add a new section between "FIRST — CONFIRM THE GAME ACTUALLY RUNS" and "HARNESS INFRASTRUCTURE FAILURE" called "BROWSER PAGE ERRORS — CODE DEFECT, NOT INFRA".
- This section instructs the reviewer to:
  1. Check `metrics.json.pageerrors` (or `metrics.json.failure_kind == "browser_pageerror"`).
  2. If non-empty, list each page error with file:line in the gaps output.
  3. Attribute the failure to game code, not harness infra.
- Update the "HARNESS INFRASTRUCTURE FAILURE" section to say: this section only applies when `harness_failure` is present AND `pageerrors` is empty/absent.

## Verification: code
