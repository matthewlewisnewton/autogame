## Copy Ranged Minion Attack Interval From Card Stats

`storm_eagle` and `thunderbird` now declare `attackIntervalMs` in `game/shared/cardStats.json`, but their live creature spawn path does not copy that value onto the minion instance. Current behavior still works because `game/server/simulation.js` falls back to the same 1500 ms value, but copying the stat would keep future tuning changes in one source of truth.

### Acceptance Criteria
- Spawning `storm_eagle` and `thunderbird` minions copies `cardDef.attackIntervalMs` onto the minion instance.
- A server test verifies a spawned ranged minion uses the interval from `cardStats.json`, not only the simulation fallback.
