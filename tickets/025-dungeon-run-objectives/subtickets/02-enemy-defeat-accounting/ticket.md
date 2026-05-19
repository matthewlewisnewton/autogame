# Enemy Defeat Accounting

Wire the run objective's `defeatedEnemies` counter into every code path that removes dead enemies. The counter must clamp at `totalEnemies` so it never overshoots.

## Acceptance Criteria
- A `recordEnemyDefeated(count = 1)` helper exists that increments `gameState.run.objective.defeatedEnemies` by `count`.
- A `clampObjectiveProgress(run)` helper caps `run.objective.defeatedEnemies` at `run.objective.totalEnemies`.
- `recordEnemyDefeated()` calls `clampObjectiveProgress()` internally after incrementing.
- Every path that filters dead enemies from `gameState.enemies` calls `recordEnemyDefeated()` with the number of enemies removed:
  - Weapon card resolution (the `gameState.enemies.filter(e => e.hp > 0)` line in the weapon branch of `useCard`).
  - Summon card resolution (the filter line in the summon branch of `useCard`).
  - Minion update cleanup (the filter line in `updateMinions()`).
- Calling `recordEnemyDefeated()` when `gameState.run` is undefined (e.g., lobby phase) is a safe no-op.
- The defeated count never exceeds `totalEnemies`, even if multiple code paths fire in the same tick.

## Technical Specs
- **File**: `game/server/index.js`
  - Add `recordEnemyDefeated(count = 1)` — guard against missing `gameState.run`, increment, then clamp.
  - Add `clampObjectiveProgress(run)` — set `run.objective.defeatedEnemies = Math.min(run.objective.defeatedEnemies, run.objective.totalEnemies)`.
  - In the **weapon branch** of `useCard`: compute `const defeated = gameState.enemies.length - filtered.length` before the filter, then call `recordEnemyDefeated(defeated)`.
  - In the **summon branch** of `useCard`: same pattern — count before filter, call after.
  - In `updateMinions()`: same pattern on the `gameState.enemies.filter(e => e.hp > 0)` line.
  - Export `recordEnemyDefeated` and `clampObjectiveProgress` in the module.exports block for unit testing.

## Verification: code
