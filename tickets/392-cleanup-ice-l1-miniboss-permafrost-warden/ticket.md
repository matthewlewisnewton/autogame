# Cleanup nits from 380-ice-l1-miniboss-permafrost-warden

> **Staleness note.** This follow-up ticket was written against commit
> `b2492d5c` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `380-ice-l1-miniboss-permafrost-warden`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Clean Up Socket Disconnect Noise In Tests

The coverage log shows intermittent `[socket:disconnect] handler error: TypeError: Cannot read properties of undefined (reading 'type')` output while unrelated card wind-up tests are running. The suite still passes and the captured browser run is clean, but this stderr noise makes future real regressions harder to spot.

### Acceptance Criteria
- Test runs no longer emit socket disconnect handler errors when unit tests temporarily install a run-like state without a full objective.
- The disconnect path either ignores malformed test-only run state safely or the affected tests isolate/reset shared server state before sockets disconnect.
