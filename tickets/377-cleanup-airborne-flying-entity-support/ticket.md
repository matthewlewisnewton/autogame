# Cleanup nits from 376-airborne-flying-entity-support

> **Staleness note.** This follow-up ticket was written against commit
> `523dfb66` (2026-06-09). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `376-airborne-flying-entity-support`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Align Player Default Hover Fallback

The server `resolveEntityY()` supports `flying` entities with no explicit `altitude` by using `DEFAULT_FLY_ALTITUDE`, but the player snapshot normalizes missing player altitude to `0` and the local player render path uses that snapshot altitude fallback. This is not blocking because a future player fly card can set an explicit altitude, but aligning the client/player snapshot fallback with the server default would make the general airborne contract tighter.

### Acceptance Criteria
- A flying player with no explicit altitude renders locally at the same default hover height that `resolveEntityY()` applies on the server.
