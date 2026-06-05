# Cleanup nits from 229-hub-stage-layout-server

> **Staleness note.** This follow-up ticket was written against commit
> `6eb8f79` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `229-hub-stage-layout-server`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Normalize Hub Passage Metadata for Rendering

`generateHub()` currently models adjoining/near-adjoining hub rooms with passage records whose `corridorLength` is `0`. Server collision and walkability are covered, but if the `hub` profile is rendered in the client, `buildPassageFloorSpec()` falls back to a full center-to-center passage floor, which can overlap room floors or hide the true short corridor length.

### Acceptance Criteria
- Hub passage metadata either reports the real corridor length between room edges or uses a representation that does not create overlapping passage floor geometry when rendered by the client.
- Existing hub walkability and anchor tests continue to pass.
