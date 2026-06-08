# 01-add-attack-interval-gate

Add an `attackIntervalMs` + `lastAttackAt` gate to the `storm_eagle`/`thunderbird` minion block in `simulation.js`, mirroring the `null_crawler` pattern. The gate should prevent the minion from firing more than once per interval — for thunderbird, the entire chain (primary hit + all chain hops) fires as one unit per interval.

## Acceptance Criteria

- The `storm_eagle`/`thunderbird` block reads `minion.attackIntervalMs` (with a fallback, e.g. `|| 1500`)
- The block reads `minion.lastAttackAt ?? 0` and only enters the damage branch when `now - lastAttackAt >= attackIntervalMs`
- On a successful hit, `minion.lastAttackAt` is set to `now`
- For `thunderbird`, the entire chain loop is inside the interval gate (one chain per interval, not one chain hop per interval)
- When the interval has not elapsed, the minion skips damage (falls through to chase/follow behavior)
- Per-hit `attackDamage` values are unchanged (still 13 for storm_eagle, 20 for thunderbird)

## Technical Specs

- **File:** `game/server/simulation.js` — the `storm_eagle`/`thunderbird` block starting around line 2877
- Read `attackIntervalMs` from `minion.attackIntervalMs || 1500` (default fallback; real value comes from cardStats.json)
- Read `const lastAttackAt = minion.lastAttackAt ?? 0;`
- Wrap the `if (nearestDist <= attackRange)` damage branch with `if (now - lastAttackAt >= attackIntervalMs) { … minion.lastAttackAt = now; }`
- For thunderbird, the chain loop must be inside this same gated block
- Match the `null_crawler` pattern (lines ~2927) for consistency

## Verification: code
