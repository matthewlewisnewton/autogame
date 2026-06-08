# 03-test-attack-interval-gate

Add server-side unit tests asserting that `storm_eagle` and `thunderbird` minions respect the `attackIntervalMs` gate — firing at most once per interval rather than every simulation tick.

## Acceptance Criteria

- Test: storm_eagle fires on first tick when enemy is in range, but does NOT fire again on a second tick within the same interval (enemy HP only drops by one `attackDamage`, not two)
- Test: storm_eagle fires again after `attackIntervalMs` has elapsed (advance mock time past interval, verify second hit lands)
- Test: thunderbird fires one full chain (primary + chain hops) on first tick, but does NOT fire a second chain on a tick within the interval
- Test: thunderbird chain respects the same interval — only one chain cycle per `attackIntervalMs`
- All existing tests continue to pass (no regression in storm_eagle/thunderbird existing tests in `new_card_pack.test.js`)

## Technical Specs

- **File:** `game/server/test/new_card_pack.test.js` (add new test cases alongside existing storm_eagle/thunderbird tests)
- Use the existing test harness pattern: `addPlayer()`, set up `gameState.enemies` and `gameState.minions`, call `updateMinions()`, `cleanupAfterDamage()`
- For the interval test, call `updateMinions()` twice in quick succession (same `now` timestamp or within interval) and assert enemy HP only dropped once
- For the elapsed test, manipulate `minion.lastAttackAt` to be older than `attackIntervalMs` before the second `updateMinions()` call, and assert a second hit lands
- Follow the existing test patterns in `new_card_pack.test.js` (lines ~440–520)

## Verification: code
