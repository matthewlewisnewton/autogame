# Cleanup nits from 303-card-balance-analysis

> **Staleness note.** This follow-up ticket was written against commit
> `eded37f0` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `303-card-balance-analysis`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Revisit Coverage Floors After Monolith Coverage Cleanup

Ticket 303 lowered the configured coverage floors to match the current full-suite baseline, which is acceptable for this ticket but leaves less headroom as a long-term quality gate. Once the large server/client monoliths are split or covered more directly, raise the thresholds again so future unrelated work cannot coast on the lower baseline.

### Acceptance Criteria
- Coverage thresholds in `game/vitest.config.js` are reviewed against the then-current full-suite coverage report.
- Any threshold increases are backed by a passing `pnpm test` run.
