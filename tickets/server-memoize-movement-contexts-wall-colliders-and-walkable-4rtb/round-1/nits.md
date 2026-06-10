## Add unit test for movement-context cache hits

The memoization logic in `buildMovementContext` and `buildHubMovementContext` is only exercised indirectly through movement tests. A small focused test would guard against future regressions that accidentally rebuild every tick or fail to invalidate on passage-lock changes.

### Acceptance Criteria
- A test calls `buildMovementContext(state)` twice with the same `state.layout` reference and passage locks; the second call returns the identical object (`===`).
- After mutating `state.run.passageLocks` (or assigning a new `state.layout`), the next call returns a different object with updated colliders.
- A test calls `buildHubMovementContext(HUB_LAYOUT)` twice and asserts reference equality on the second call.
