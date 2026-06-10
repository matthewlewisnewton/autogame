# Add attack-interval gating to bulkhead_mauler minion

The `bulkhead_mauler` branch in `updateMinions()` (`game/server/simulation.js` ~line 3083) has no `lastAttackAt`/`attackIntervalMs` gating, so it swings its 9-damage cone every simulation tick (~180 DPS at TICK_RATE=20) and pushes a `_pendingMinionBreaths` entry per swing — broadcast as a `CARD_USED` event to the whole lobby at ~20 events/sec. Add the same time-gated pattern used by `null_crawler` (2000 ms) and `storm_eagle` (1500 ms).

## Acceptance Criteria

- `updateMinions()` mauler branch reads `minion.attackIntervalMs` (default **1500 ms**) and `minion.lastAttackAt` before attacking
- Mauler attacks at most once per `attackIntervalMs`; multiple ticks without enough elapsed time do NOT deal damage or push breaths
- `_pendingMinionBreaths` is pushed at most once per attack (same as before, but now rate-limited)
- `cardStats.json` defines `attackIntervalMs: 1500` for `bulkhead_mauler` so the minion picks it up at spawn
- Existing tests in `creature_minions.test.js` updated to pass with the new gating (minion fixture gets `lastAttackAt: 0` so the first call still hits)

## Technical Specs

- **`game/server/simulation.js`** — In the `bulkhead_mauler` branch of `updateMinions()`, wrap the cone-attack block inside `if (now - lastAttackAt >= attackIntervalMs) { …; minion.lastAttackAt = now; }`, matching the pattern at the `null_crawler` branch (lines ~3016-3040). Use `const attackIntervalMs = minion.attackIntervalMs || 1500;` and `const lastAttackAt = minion.lastAttackAt ?? 0;`.
- **`game/shared/cardStats.json`** — Add `"attackIntervalMs": 1500` to the `bulkhead_mauler` entry so spawned minions carry the interval.
- **`game/server/test/creature_minions.test.js`** — Add `lastAttackAt: 0` to mauler minion fixtures in the "deals damage in a wide short-range cone" test so the first `updateMinions()` call still fires. Add a new test verifying that calling `updateMinions()` twice within the same tick does NOT deal double damage.

## Verification: code
