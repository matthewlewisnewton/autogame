# Server Run State Creation & Emission

Add `gameState.run` on the server so that every dungeon run has a tracked objective. The run object is initialized when the game transitions to `playing` and included in all state payloads sent to clients.

## Acceptance Criteria
- `gameState.run` does **not** exist while `gamePhase` is `'lobby'`.
- When the game transitions to `'playing'` (via `checkAllReady` or debug scenarios), the server creates `gameState.run` with:
  - `id`: a unique string (e.g., `crypto.randomUUID()`).
  - `status`: `'playing'`.
  - `objective.type`: exactly `'defeat_enemies'`.
  - `objective.label`: a short player-facing string such as `'Defeat all enemies'`.
  - `objective.totalEnemies`: set to `gameState.enemies.length` at the moment the run starts.
  - `objective.defeatedEnemies`: `0`.
  - `startedAt`: a numeric timestamp (`Date.now()`).
- The run `id` changes each time a new run starts (e.g., after `resetGameState` + re-entering playing).
- `stateSnapshot()` includes the `run` object so it flows through `stateUpdate` events.
- The `init` payload sent to newly connecting clients includes the current `run` (if one exists).
- Existing behavior (lobby ready flow, enemy spawning, movement) is unaffected.

## Technical Specs
- **File**: `game/server/index.js`
  - Add `createRunState()` helper that builds the run object from current `gameState.enemies.length`.
  - Add `startDungeonRun()` helper that assigns `gameState.run = createRunState()`.
  - Call `startDungeonRun()` from `checkAllReady()` (after setting `gamePhase = 'playing'`) and from `enterPlayingPhase()` (used by debug scenarios).
  - Include `run` in `stateSnapshot()` output (it's already a spread of `gameState`, so adding `gameState.run` before the spread is sufficient — just ensure `delete snapshot.layout` does not also delete `run`).
  - Ensure `init` emission includes `run: gameState.run` in its payload.
  - Call `startDungeonRun()` in `resetGameState()` or ensure it clears `gameState.run` so a fresh run is created on next transition.

## Verification: code
