# Route taunt minion attacks through the enemy windup state machine

The taunt branch in `updateEnemies()` (`game/server/simulation.js:2927-2935`) calls `damageMinion()` directly every tick whenever a taunt minion is in range — bypassing windup, `ENEMY_ATTACK_RECOVERY_MS`, and per-attack cooldown. At `TICK_RATE=20` that is 20 full-damage hits per second. Fix: guard the taunt branch so it only triggers when the enemy's `attackState` is `'chasing'` or `'idle'`, and when in range, set `windupTargetType: 'minion'`, `windupTargetId`, and `attackState: 'windup'` to route through the existing windup → strike → recovery path (lines 2858-2893).

## Acceptance Criteria

- The taunt branch in `updateEnemies` checks `enemy.attackState` before acting:
  - When `attackState` is `'windup'` or `'recovering'`, the taunt branch does NOT deal damage and does NOT reset windup state (falls through to the existing windup/recovery handling above it in the loop)
  - When `attackState` is `'chasing'` or `'idle'` and the taunt minion is within attack range, the enemy transitions to `attackState: 'windup'` with `windupTargetType: 'minion'` and `windupTargetId` set to the minion's id
  - When out of range, the enemy chases the taunt minion as before
- The existing windup strike block (lines ~2876) already handles `windupTargetType === 'minion'` by calling `damageMinion()` — no change needed there
- The direct `damageMinion(tauntMinion, enemy.attackDamage)` call is removed from the taunt branch

## Technical Specs

- **File**: `game/server/simulation.js`
- **Change**: Lines ~2927-2935 (the `if (tauntMinion)` block inside `updateEnemies`)
- **Implementation**:
  1. Add guard: only enter the taunt-attack logic when `enemy.attackState === 'chasing' || enemy.attackState === 'idle'`
  2. Replace `damageMinion(tauntMinion, enemy.attackDamage)` with windup setup:
     ```
     enemy.attackState = 'windup';
     enemy.windupTargetType = 'minion';
     enemy.windupTargetId = tauntMinion.id;
     enemy.windupStartTime = Date.now();
     lockWindupDirection(enemy, tauntMinion);
     continue;
     ```
  3. Keep the chase-fallback (`moveEntityToward`) for out-of-range case
  4. Keep the `continue` at end of taunt block to skip normal target selection

## Verification: code
