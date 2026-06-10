# Fix taunt tests and add windup cadence regression test

Two existing tests assert the buggy behavior (instant damage on first `updateEnemies()` call for taunt minions): `aegis_sentinel.test.js` ("taunt minion draws enemy attacks away from the caster") and `minion_damage.test.js` ("Necroframe Knight taunt damage burns HP and TTL"). Both need updating to expect windup state on tick 1 and damage on tick 2. Additionally, a new regression test should verify that a taunt minion takes at most one strike per enemy attack cycle (windup + recovery), not one per tick.

## Acceptance Criteria

- `game/server/test/aegis_sentinel.test.js`: "taunt minion draws enemy attacks away from the caster" — updated to run two `updateEnemies()` ticks; first tick sets enemy to `attackState: 'windup'`, second tick (after windup elapsed) deals damage; player HP remains unchanged
- `game/server/test/minion_damage.test.js`: "Necroframe Knight taunt damage burns HP and TTL" — updated same way: two ticks, windup on tick 1, damage on tick 2
- New test in `game/server/test/minion_damage.test.js` (or a new `taunt_windup_cadence.test.js`): verifies that running `updateEnemies()` multiple times (simulating many ticks), a single enemy deals at most one strike per `attackWindupMs + ENEMY_ATTACK_RECOVERY_MS` cycle against a taunt minion — i.e., the minion does NOT take damage every tick
- All existing non-taunt enemy attack tests continue to pass

## Technical Specs

- **Files**: `game/server/test/aegis_sentinel.test.js`, `game/server/test/minion_damage.test.js`
- **Implementation**:
  1. In `aegis_sentinel.test.js`, the "taunt minion draws enemy attacks" test: after setting up the scene, call `updateEnemies()` once and assert `enemy.attackState === 'windup'` and minion HP is still 160. Then advance time past `attackWindupMs` and call `updateEnemies()` again — assert minion HP decreased and player HP unchanged
  2. In `minion_damage.test.js`, the "Necroframe Knight taunt damage" test: same two-tick pattern — windup on tick 1, damage+TTL burn on tick 2
  3. New regression test: set up enemy + taunt minion in range; loop 10+ ticks (advancing `Date.now()` via `jest.useFakeTimers()` or manual `windupStartTime` manipulation); count number of times minion HP decreases; verify count ≤ expected strikes for the total elapsed time (roughly `totalTime / (attackWindupMs + ENEMY_ATTACK_RECOVERY_MS)`)

## Verification: code
