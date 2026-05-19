# Tests: Telegraphs and Audio

Add unit and integration tests for enemy attack wind-up state transitions, range revalidation, and the client audio helper.

## Acceptance Criteria
- Unit test: enemy in `chasing` state within `ENEMY_ATTACK_RANGE` transitions to `windup` after one `updateEnemies()` tick.
- Unit test: enemy in `windup` state applies damage and transitions to `recovering` after `ENEMY_ATTACK_WINDUP_MS` elapses.
- Unit test: enemy in `windup` whose target moves out of range cancels the attack and returns to `chasing` (no damage applied).
- Unit test: enemy in `recovering` state does not move or attack, and transitions back to `chasing` after `ENEMY_ATTACK_RECOVERY_MS`.
- Unit test: `ENEMY_ATTACK_WINDUP_MS` and `ENEMY_ATTACK_RECOVERY_MS` constants are exported and have expected values.
- Integration test: connect a client, move near an enemy, and verify the enemy's `attackState` in `stateUpdate` becomes `windup` before player HP changes.
- Integration test: move player out of range during wind-up and verify player HP does not decrease.
- Client unit test: `playSound()` does not throw when `AudioContext` is unavailable or when `soundEnabled` is `false`.

## Technical Specs
- **File:** `game/server/test/server.test.js`
  - Add describe block `'Enemy attack state machine'`:
    - Test `'transitions to windup when in range'`: set up enemy in `chasing` near a player within `ENEMY_ATTACK_RANGE`, call `updateEnemies()`, assert `enemy.attackState === 'windup'`.
    - Test `'applies damage after windup expires'`: set enemy `attackState = 'windup'` with `windupStartTime` in the past, call `updateEnemies()`, assert player HP decreased by `ENEMY_ATTACK_DAMAGE` and `enemy.attackState === 'recovering'`.
    - Test `'cancels attack when target leaves range'`: set enemy in `windup`, move player out of `ENEMY_ATTACK_RANGE`, call `updateEnemies()`, assert player HP unchanged and `enemy.attackState === 'chasing'`.
    - Test `'recovers and returns to chasing'`: set enemy in `recovering` with `recoverUntil` in the past, call `updateEnemies()`, assert `enemy.attackState === 'chasing'`.
    - Test `'constants exported'`: assert `ENEMY_ATTACK_WINDUP_MS >= 800` and `ENEMY_ATTACK_RECOVERY_MS >= 1000`.
- **File:** `game/server/test/integration.test.js`
  - Add describe block `'Enemy telegraph integration'`:
    - Test `'enemy enters windup before damaging player'`: connect client, move player near enemy, waitFor `stateUpdate` with enemy `attackState === 'windup'`, then waitFor HP change.
    - Test `'moving out of range avoids damage'`: connect client, move near enemy to trigger windup, then move player far away, assert HP stays at 100.
- **File:** `game/client/test/main.test.js`
  - Add describe block `'Audio helper'`:
    - Test `'playSound does not throw when soundEnabled is false'`: stub `soundEnabled = false`, call `playSound('card')`, assert no exception.
    - Test `'playSound does not throw when AudioContext is unavailable'`: set `window.AudioContext = undefined`, call `playSound('card')`, assert no exception.

## Verification: code
