# Gate bulkhead_mauler attack interval in updateMinions

The `bulkhead_mauler` branch in `updateMinions()` (`game/server/simulation.js` ~line 3416) has no `lastAttackAt`/`attackIntervalMs` gating — it deals damage and pushes a `_pendingMinionBreaths` entry every simulation tick (~20×/sec, ~180 DPS). Add interval gating matching the pattern used by `storm_eagle` (1500 ms) and `null_crawler` (2000 ms), and define `attackIntervalMs` in `cardStats.json`.

## Acceptance Criteria

- `bulkhead_mauler` minions in `updateMinions()` read `minion.attackIntervalMs` (default 1500 ms) and `minion.lastAttackAt`, and only attack when `now - lastAttackAt >= attackIntervalMs`
- `minion.lastAttackAt` is set to `now` after each successful attack
- `cardStats.json` defines `attackIntervalMs: 1500` for the `bulkhead_mauler` card
- Existing mauler tests in `creature_minions.test.js` still pass; add a test verifying the mauler attacks at most once per `attackIntervalMs` window

## Technical Specs

- **`game/server/simulation.js`** (~line 3416): In the `bulkhead_mauler` branch, add `const attackIntervalMs = minion.attackIntervalMs || 1500;` and `const lastAttackAt = minion.lastAttackAt ?? 0;` — wrap the attack block in `if (now - lastAttackAt >= attackIntervalMs) { … minion.lastAttackAt = now; }`
- **`game/shared/cardStats.json`**: Add `"attackIntervalMs": 1500` to the `bulkhead_mauler` entry
- **`game/server/test/creature_minions.test.js`**: Add test that creates a mauler, calls `updateMinions()` twice within the interval, and asserts only one `_pendingMinionBreath` is pushed

## Verification: code
