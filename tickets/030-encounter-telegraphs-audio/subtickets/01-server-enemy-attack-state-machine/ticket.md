# Server: Enemy Attack State Machine

Add a server-side attack state machine to enemies so attacks have a visible wind-up phase, a recovery window, and range revalidation before damage lands.

## Acceptance Criteria
- Enemies cycle through `idle` / `chasing` / `windup` / `recovering` states (replacing the current `idle` / `chasing` only logic).
- When an enemy is in `chasing` state and within `ENEMY_ATTACK_RANGE` of a living player, it transitions to `windup` for `ENEMY_ATTACK_WINDUP_MS` (≥ 800 ms).
- After wind-up, the server revalidates that the target player is still within range before applying `ENEMY_ATTACK_DAMAGE` HP damage.
- If the target leaves range during wind-up, the attack is cancelled and the enemy returns to `chasing`.
- After a successful (or cancelled) attack, the enemy enters `recovering` for `ENEMY_ATTACK_RECOVERY_MS` (≥ 1000 ms) before returning to `chasing` or `idle`.
- Enemy state objects include `attackState`, `windupTargetId`, and `windupStartTime` fields when in wind-up.
- The `stateSnapshot()` includes the `attackState` on each enemy so the client can render telegraphs.
- Constants are exported: `ENEMY_ATTACK_RANGE`, `ENEMY_ATTACK_DAMAGE`, `ENEMY_ATTACK_WINDUP_MS`, `ENEMY_ATTACK_RECOVERY_MS`.

## Technical Specs
- **File:** `game/server/index.js`
  - Add named constants: `ENEMY_ATTACK_RANGE` (4 units), `ENEMY_ATTACK_DAMAGE` (10), `ENEMY_ATTACK_WINDUP_MS` (800), `ENEMY_ATTACK_RECOVERY_MS` (1200).
  - Modify `updateEnemies()`: when an enemy in `chasing` is within `ENEMY_ATTACK_RANGE` of its nearest player, transition to `windup` (set `enemy.attackState = 'windup'`, `enemy.windupTargetId`, `enemy.windupStartTime = Date.now()`).
  - When `attackState === 'windup'` and elapsed ≥ `ENEMY_ATTACK_WINDUP_MS`, revalidate range; if target still in range, call `damagePlayer(targetId, ENEMY_ATTACK_DAMAGE)` and set `attackState = 'recovering'`, `enemy.recoverUntil = Date.now() + ENEMY_ATTACK_RECOVERY_MS`. If target out of range or dead, cancel: set `attackState = 'chasing'`.
  - When `attackState === 'recovering'` and `Date.now() >= enemy.recoverUntil`, set `attackState = 'chasing'`.
  - While in `windup` or `recovering`, the enemy does NOT move (skip chase/wander movement).
  - Add `attackState` field to each enemy in `stateSnapshot()` output (already included since enemies are spread into snapshot).
  - Export new constants in the `module.exports` block.
  - Default `attackState` on newly spawned enemies is `'idle'`.

## Verification: code
