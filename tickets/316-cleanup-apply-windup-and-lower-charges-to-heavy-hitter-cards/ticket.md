# Cleanup nits from 308-apply-windup-and-lower-charges-to-heavy-hitter-cards

> **Staleness note.** This follow-up ticket was written against commit
> `9aa6fda2` (2026-06-08). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `308-apply-windup-and-lower-charges-to-heavy-hitter-cards`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Clean Up Noisy Test Fixture Errors In Coverage Logs

The coverage run passes, but `coverage.log` includes non-fatal stderr from synthetic test states, including socket-disconnect and game-loop errors about incomplete objective/enemy data. This is not a ticket blocker, but it makes future real regressions harder to spot in coverage output.

### Acceptance Criteria
- The relevant server test fixtures construct complete playing-run/objective/enemy state, or otherwise isolate teardown, so the coverage log no longer emits `[socket:disconnect] handler error` or `[gameLoop] tick failed` messages from intentionally synthetic test setup.
