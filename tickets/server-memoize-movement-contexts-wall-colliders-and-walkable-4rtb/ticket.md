# Server: memoize movement contexts — wall colliders and walkable AABBs rebuilt from scratch every tick

## Difficulty: easy

## Goal

runGameLoopTick calls buildMovementContext(state) (playing) or buildHubMovementContext(HUB_LAYOUT) (lobby) every tick per lobby (game/server/index.js:1397,1402); both call buildWallColliders() and the hub variant also computeWalkableAABBs() (game/server/simulation.js:128-151), allocating fresh collider arrays 20x/sec per lobby even though layouts rarely change. A layout-keyed cache already exists (getWallColliders/rebuildWallColliders, simulation.js:110-123) but these context builders bypass it; the hub layout is a static constant so the lobby-phase rebuild is pure waste. Fix: memoize both contexts by layout reference (same pattern as _wallCollidersLayout), invalidating when state.layout changes. Found in code review 2026-06-09.

## Acceptance Criteria

- Movement contexts are cached by layout reference and reused across ticks; cache invalidates when state.layout changes; collision behavior unchanged (existing tests pass)

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
