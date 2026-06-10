## Explicit bulkhead_mauler spawn interval in cardEffects

The `null_crawler` spawn block in `cardEffects.js` explicitly sets `attackIntervalMs` and primes `lastAttackAt`; `bulkhead_mauler` relies on the generic minion factory plus `cardStats.json`. Mirroring the explicit pattern would make the interval harder to regress if cardStats drifts.

### Acceptance Criteria
- `bulkhead_mauler` spawn handler assigns `attackIntervalMs` from `cardDef` and sets `lastAttackAt` the same way `null_crawler` does.
- Existing `creature_minions.test.js` mauler tests still pass.

## Rename astral_guardian per-tick DPS test after interval fix

`astral_guardian.test.js` includes a test titled "astral guardian minion deals more damage per tick than default minions" that asserts one-tick `attackIntervalMs`. Once guardian intervals are fixed, the name and comparison semantics should reflect per-attack damage, not per-tick DPS.

### Acceptance Criteria
- Test name and assertions describe per-attack damage at the configured interval, not per-tick rate.
- Test still verifies astral guardian out-damages a default minion per successful attack.
