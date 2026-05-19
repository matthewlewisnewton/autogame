# Extract `removeDeadEnemies()` helper

The same "snapshot length, filter, diff, recordEnemyDefeated" pattern is duplicated across the minion cleanup, weapon card, and summon card paths in `game/server/index.js`. Extract a single `removeDeadEnemies()` helper to eliminate duplication.

## Acceptance Criteria
- A new `removeDeadEnemies()` function exists in `game/server/index.js` that:
  - Filters dead enemies (`hp <= 0`) from `gameState.enemies`
  - Returns the count of removed enemies
- All three enemy-removal sites call `removeDeadEnemies()` instead of inline filter+diff logic
- The `recordEnemyDefeated()` call is made inside the helper (or by the caller using its return value)
- All existing tests pass; no behavioral change

## Technical Specs
- **File:** `game/server/index.js`
- Create `function removeDeadEnemies()` that does:
  ```js
  const before = gameState.enemies.length;
  gameState.enemies = gameState.enemies.filter(e => e.hp > 0);
  return before - gameState.enemies.length;
  ```
- Replace the inline filter+diff blocks at ~line 820-823 (minion), ~line 1041-1044 (weapon), ~line 1097-1100 (summon) with calls to `removeDeadEnemies()`
- Each caller should still spawn loot for dead enemies before calling the helper (loot spawn is not part of the helper since it iterates dead enemies before they're removed)

## Verification: code
