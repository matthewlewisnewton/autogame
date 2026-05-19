# Pause entity AI while a run is terminal

After a run reaches `victory` or `failed`, the server game loop keeps calling `updateEnemies()` and `updateMinions()` every tick. Enemies and minions continue moving/attacking behind the run summary overlay, which looks wrong. Freeze AI updates once the run is terminal.

## Acceptance Criteria
- When `gameState.run.status` is `'victory'` or `'failed'`, `updateEnemies()` must skip all enemy AI logic (no movement, no attacking, no state transitions).
- When `gameState.run.status` is `'victory'` or `'failed'`, `updateMinions()` must skip all minion AI logic (no movement, no attacking). Note: minion TTL expiry / cleanup may still run if desired, but AI chasing/attacking must be skipped.
- AI must resume normally on the next run (after `returnToLobby` and a new `startDungeonRun`).

## Technical Specs
- **File:** `game/server/index.js`
- At the top of `updateEnemies()` (line ~667), add an early return guard:
  ```js
  if (gameState.run && (gameState.run.status === 'victory' || gameState.run.status === 'failed')) return;
  ```
- At the top of `updateMinions()` (line ~770), add the same early return guard.
- Add unit tests in `game/server/test/server.test.js` verifying both functions are no-ops when `gameState.run.status` is `'victory'` or `'failed'`.

## Verification: code
