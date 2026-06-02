# Cleanup nits from 135-world-open-plaza-stage

> **Staleness note.** This follow-up ticket was written against commit
> `959603f` (2026-06-01). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `135-world-open-plaza-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Update Open-Plaza Generator Comment

`generateOpenPlaza()` still has a doc comment saying the plaza output is identical for any seed because the empty plaza is fixed. The implementation now uses the seed for deterministic cover placement, so the comment should be updated to avoid misleading future work.

### Acceptance Criteria
- The `generateOpenPlaza()` comment accurately states that the base arena is fixed while cover placement varies deterministically by seed.
