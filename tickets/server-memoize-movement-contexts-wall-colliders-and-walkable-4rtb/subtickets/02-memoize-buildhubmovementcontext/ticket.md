# Memoize buildHubMovementContext by layout reference

`buildHubMovementContext(HUB_LAYOUT)` in `game/server/simulation.js` calls `computeWalkableAABBs()` and `buildWallColliders()` every tick (20x/sec) for each lobby in the lobby phase. `HUB_LAYOUT` is a static constant — the context never changes. Add a layout-reference cache so the hub movement context is computed once and reused indefinitely.

## Acceptance Criteria

- A `_hubMovementContext` and `_hubMovementContextLayout` cache is added in `simulation.js`
- `buildHubMovementContext(hubLayout)` returns the cached context when `hubLayout` reference matches the previous call
- Cache invalidates (rebuilds) when a different layout reference is passed
- All existing tests pass (hub movement collision behavior unchanged)

## Technical Specs

- **File:** `game/server/simulation.js`
- Add module-level variables: `_hubMovementContext`, `_hubMovementContextLayout`
- Modify `buildHubMovementContext(hubLayout)` to check `hubLayout === _hubMovementContextLayout` before building; fall through to rebuild on miss
- Because `HUB_LAYOUT` is a constant and all lobbies share it, a single module-level cache serves all lobbies

## Verification: code
