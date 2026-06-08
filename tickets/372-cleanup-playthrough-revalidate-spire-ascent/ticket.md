# Cleanup nits from 371-playthrough-revalidate-spire-ascent

> **Staleness note.** This follow-up ticket was written against commit
> `7e208b5f` (2026-06-08). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `371-playthrough-revalidate-spire-ascent`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## De-flake Arena-Trials Debug Scenario Test

`game/validation/spire-ascent/findings.md` records that a separate `test:quick` run saw an arena-trials debug-scenario test fail under full-suite ordering while passing in isolation. It is unrelated to the spire-ascent validation ticket, but it is worth isolating so future validation reports do not have to explain the same noisy failure.

### Acceptance Criteria
- The arena-trials debug-scenario test passes consistently when run alone and as part of the relevant server test suite.
- Shared debug-scenario/lobby/global state is reset between tests so `arena-trials-boss-approach` does not observe stale adds or stale objective state.
