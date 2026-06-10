# Cleanup nits from server-memoize-movement-contexts-wall-colliders-and-walkable-4rtb

> **Staleness note.** This follow-up ticket was written against commit
> `ff8e1c22` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `server-memoize-movement-contexts-wall-colliders-and-walkable-4rtb`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add unit test for movement-context cache hits

The memoization logic in `buildMovementContext` and `buildHubMovementContext` is only exercised indirectly through movement tests. A small focused test would guard against future regressions that accidentally rebuild every tick or fail to invalidate on passage-lock changes.

### Acceptance Criteria
- A test calls `buildMovementContext(state)` twice with the same `state.layout` reference and passage locks; the second call returns the identical object (`===`).
- After mutating `state.run.passageLocks` (or assigning a new `state.layout`), the next call returns a different object with updated colliders.
- A test calls `buildHubMovementContext(HUB_LAYOUT)` twice and asserts reference equality on the second call.
