# Cleanup nits from 309-fix-storm-eagle-thunderbird-attack-interval-gate

> **Staleness note.** This follow-up ticket was written against commit
> `1cb44080` (2026-06-08). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `309-fix-storm-eagle-thunderbird-attack-interval-gate`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Copy Ranged Minion Attack Interval From Card Stats

`storm_eagle` and `thunderbird` now declare `attackIntervalMs` in `game/shared/cardStats.json`, but their live creature spawn path does not copy that value onto the minion instance. Current behavior still works because `game/server/simulation.js` falls back to the same 1500 ms value, but copying the stat would keep future tuning changes in one source of truth.

### Acceptance Criteria
- Spawning `storm_eagle` and `thunderbird` minions copies `cardDef.attackIntervalMs` onto the minion instance.
- A server test verifies a spawned ranged minion uses the interval from `cardStats.json`, not only the simulation fallback.
