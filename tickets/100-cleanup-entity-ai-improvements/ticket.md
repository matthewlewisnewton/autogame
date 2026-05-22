# Cleanup nits from 024-entity-ai-improvements

> **Staleness note.** This follow-up ticket was written against commit
> `8af88db` (2026-05-22). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `024-entity-ai-improvements`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Make Movement Reached Metadata Exact
`moveEntityToward()` currently reports `reached: true` only when the entity starts within `stopDistance`; if a move lands exactly on the target, the movement succeeds but `reached` remains false. No current caller depends on this value, but tightening it would make the helper's metadata less surprising for future AI behavior.

### Acceptance Criteria
- `moveEntityToward()` reports `reached: true` when the applied move brings the entity to the target or within `stopDistance`.
- Existing enemy and minion movement behavior remains unchanged except for the corrected metadata.
