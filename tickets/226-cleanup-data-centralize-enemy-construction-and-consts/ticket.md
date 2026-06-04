# Cleanup nits from 225-data-centralize-enemy-construction-and-consts

> **Staleness note.** This follow-up ticket was written against commit
> `d8f29b0` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `225-data-centralize-enemy-construction-and-consts`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Use Spawn Helper In Run-Exhausted Debug Fixture

The `run-exhausted` debug scenario still hand-constructs a terminal-state enemy object instead of using `spawnEnemy()`. It does not block this ticket because the scenario immediately marks the run failed before enemy AI runs, but using the central helper would keep all debug fixtures aligned with the new enemy construction contract.

### Acceptance Criteria
- The `run-exhausted` debug scenario creates its remaining enemy through `spawnEnemy()` or includes the same self-describing fields as a spawned grunt.
- Existing `run-exhausted` integration coverage still passes.
