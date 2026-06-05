# Thread explicit state through player movement

Refactor server-side player movement so `applyPlayerMovement` and its collision/bounds helpers take an explicit lobby `state` (and movement context) instead of reading the module-level `_gameState` global. Behavior for `gamePhase === 'playing'` must remain unchanged after this sub-ticket.

## Acceptance Criteria

- `applyPlayerMovement(state, movementContext)` accepts the lobby state object as its first argument; the function body does not read `_gameState` for player iteration, phase checks, or layout/bounds during movement.
- Movement displacement (`tryPlayerMove` / `tryDisplacement`) uses `movementContext` for `layout`, `walkableAABBs`, and `dungeonBounds` rather than implicit globals.
- `runGameLoopTick` in `index.js` passes `lobby.state` (and a playing-phase movement context derived from that state) into `applyPlayerMovement`.
- Existing `applyPlayerMovement` unit tests in `game/server/test/applyPlayerMovement.test.js` still pass without changing their behavioral expectations.
- Lobby-phase movement is still gated off (`applyPlayerMovement` returns early when not in playing phase) — enabling lobby walks is deferred to sub-ticket 02.

## Technical Specs

- **`game/server/simulation.js`**
  - Add a `MovementContext` shape: `{ layout, walkableAABBs, dungeonBounds, colliders? }`.
  - Add `buildMovementContext(state)` for the playing phase (uses `state.layout`, `state.walkableAABBs`, `state.dungeonBounds`; rebuild colliders from `layout` when needed).
  - Change `applyPlayerMovement(state, movementContext)` signature; thread context into `tryPlayerMove` → `tryDisplacement` → `clampToDungeon` / `isInsideDungeon`.
  - Refactor `clampToDungeon`, `isInsideDungeon`, and floor sampling in the movement path to use the passed context/layout instead of `_gameState` reads.
  - Keep the existing `!isPlayingPhase(state)` early return.
- **`game/server/index.js`**
  - In `runGameLoopTick`, call `applyPlayerMovement(state, buildMovementContext(state))` inside `withLobbyContext` for the playing branch.
- **`game/server/test/applyPlayerMovement.test.js`**
  - Update calls to pass `state` and a movement context built from that state.

## Verification: code
