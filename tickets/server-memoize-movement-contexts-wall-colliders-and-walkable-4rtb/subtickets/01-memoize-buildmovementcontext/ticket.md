# Memoize buildMovementContext by layout reference and passage locks

`buildMovementContext(state)` in `game/server/simulation.js` allocates a fresh movement context object (including `buildWallColliders()`) every tick even though the dungeon layout and passage locks rarely change. Add a layout-keyed + passage-locks-keyed cache so the context is reused across ticks and only rebuilt when `state.layout` or `state.run.passageLocks` changes.

## Acceptance Criteria

- A `_movementContext` and `_movementContextLayout` / `_movementContextPassageLocksKey` cache is added in `simulation.js`
- `buildMovementContext(state)` returns the cached context when `state.layout` and passage locks match the previous call
- Cache invalidates (rebuilds) when `state.layout` reference changes or passage locks key changes
- A `rebuildMovementContext()` helper is exported for explicit invalidation (e.g., after `resetGameState`)
- All existing tests pass (collision behavior unchanged)

## Technical Specs

- **File:** `game/server/simulation.js`
- Add module-level variables: `_movementContext`, `_movementContextLayout`, `_movementContextPassageLocksKey`
- Modify `buildMovementContext(state)` to check cache before building; fall through to rebuild on miss
- Add `rebuildMovementContext(state)` to force-cache and return the new context
- Export `rebuildMovementContext` in the module exports block (line ~3738)
- Call `rebuildMovementContext(state)` in `resetGameState()` or equivalent state-init path to clear stale cache

## Verification: code
