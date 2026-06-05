# Cleanup nits from 271-telepipe-hub-suspend-resume-integration

> **Staleness note.** This follow-up ticket was written against commit
> `8b3d3af2` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `271-telepipe-hub-suspend-resume-integration`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Reduce Duplicate Resume Controls

The suspended hub currently shows a dedicated `#resume-run-btn` while also keeping `#ready-btn` visible and re-labeled as a secondary resume control for harness compatibility. This passes the ticket because the new-mission deploy affordance is not active while suspended, but the player-facing UI would be cleaner with one obvious resume action.

### Acceptance Criteria
- While a run is suspended, the lobby presents one primary resume affordance to players, and any compatibility path for automated tests does not visually compete with it.
