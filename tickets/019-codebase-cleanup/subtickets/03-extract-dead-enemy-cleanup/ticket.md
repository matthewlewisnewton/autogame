# Extract Dead Enemy Cleanup into Single Helper

The 3-line pattern `for (const e of gameState.enemies) { if (e.hp <= 0) spawnLoot(e.x, e.z); }` followed by `if (removeDeadEnemies() > 0) { checkRunTerminalState(); }` appears in 3 places in `server/index.js` (in `updateMinions`, the weapon card branch, and the summon card branch). Extract this into a single `cleanupAfterDamage()` helper function.

## Acceptance Criteria
- A new function `cleanupAfterDamage()` exists in `server/index.js` that: (a) spawns loot for all dead enemies, (b) calls `removeDeadEnemies()`, and (c) calls `checkRunTerminalState()` if any were removed.
- All 3 call sites in `server/index.js` are replaced with a single call to `cleanupAfterDamage()`.
- The new function is exported in the conditional `module.exports` block for test access.
- All existing tests continue to pass without modification.
- No behavioral change — loot drops, enemy removal, and run-state checks are identical.

## Technical Specs
- **Modified file**: `game/server/index.js` only.
- Create `function cleanupAfterDamage()` near the existing `removeDeadEnemies()` definition (around line 277).
- Replace the 3 inline occurrences (lines ~951-954, ~1164-1167, ~1216-1219) with `cleanupAfterDamage()`.
- Add `cleanupAfterDamage` to the `module.exports` block near the bottom.
- Do not touch any test files, client files, or `server/dungeon.js`.

## Verification: code
