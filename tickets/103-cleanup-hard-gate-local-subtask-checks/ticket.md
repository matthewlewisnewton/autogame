# Cleanup harness local-check gating

> **Staleness note.** This follow-up ticket was written against commit
> `cbf7fe6` (2026-05-22). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

The sub-ticket loop starts deterministic local checks in parallel with the browser capture, but a failing local-check process is only recorded in artifacts and then left for the QA model to notice. Make that signal harder to miss so a small reviewer model cannot accidentally pass a sub-ticket whose unit tests already failed.

## Difficulty: medium

## Code references

> The references in this section were reviewed at commit `cbf7fe6`; verify them against the current code before editing.

- `harness/run_subtask.sh` `finish_pipeline_checks()` writes `local-checks.status.json` and always returns control to QA, even when `rc != 0`.
- `harness/run_subtask.sh` calls `finish_pipeline_checks "$pipeline_pid" "$ARTI"` immediately before building the QA prompt, but does not turn a failed local check into automatic feedback or a failed iteration.
- `harness/prompts/qa-code.md` tells the reviewer to inspect `local-checks.status.json` "if present", which depends on model attention instead of harness control flow.

## Acceptance Criteria

- A failed local test/check process cannot be accepted silently by a sub-ticket iteration.
- The next qwen attempt receives useful, compact feedback that points to the failed local-check status/log.
- Successful local checks keep the existing parallelism and happy-path behavior.

## Technical Specs

- Likely files: `harness/run_subtask.sh`, `harness/prompts/qa-code.md`, and related tests or fixtures if a harness test pattern exists.
- Prefer explicit harness control flow over relying only on reviewer prose. For example, after `finish_pipeline_checks`, branch on the recorded status and append deterministic feedback when the local check failed.
- Keep visual/game smoke capture behavior intact; this is about local verification failures, not transient screenshot noise.

## Verification: code
