# Cleanup nits from 374-spherical-3d-aoe-for-all-radius-effects

> **Staleness note.** This follow-up ticket was written against commit
> `3bed8371` (2026-06-09). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `374-spherical-3d-aoe-for-all-radius-effects`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Clean Up Card Windup Test Disconnect Error Noise

The coverage run passes, but `coverage.log` includes two `[socket:disconnect] handler error` traces from `card_windup_resolution.test.js` where a partial test run state reaches `isRunObjectiveComplete()` without a complete objective shape. This is non-blocking for the spherical AoE ticket, but cleaning it up would keep stderr focused on real failures.

### Acceptance Criteria
- `card_windup_resolution.test.js` no longer emits `[socket:disconnect] handler error` during the coverage run.
- Either the test fixture supplies a valid run objective or the disconnect/terminal-state path safely ignores incomplete test-only run state.
