# Cleanup nits from server-bulkhead-mauler-and-astral-guardian-minions-attack-ev-oumk

> **Staleness note.** This follow-up ticket was written against commit
> `ae108bdb` (2026-06-09). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `server-bulkhead-mauler-and-astral-guardian-minions-attack-ev-oumk`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Copy attackIntervalMs on bulkhead_mauler spawn

`null_crawler` explicitly copies `attackIntervalMs` and primes `lastAttackAt` in `cardEffects.js` when the minion is created; `bulkhead_mauler` only sets range/cone/damage and relies on the `updateMinions()` fallback (`|| 1500`). Behavior is correct today because the fallback matches `cardStats.json`, but a future cardStats tune would not propagate to spawned minions.

### Acceptance Criteria
- `bulkhead_mauler` spawn block in `cardEffects.js` assigns `attackIntervalMs` from `cardDef` and initializes `lastAttackAt` (mirroring `null_crawler`).
- Spawned mauler minions reflect a changed `attackIntervalMs` in `cardStats.json` without editing `simulation.js` fallbacks.

## Assert aegis_sentinel attackIntervalMs on spawn

`astral_guardian.test.js` now asserts `attackIntervalMs: 1500` on the spawned minion, but `aegis_sentinel.test.js` only checks combat stats and taunt — not interval inheritance from the shared `applyAstralShieldCast` path.

### Acceptance Criteria
- `aegis_sentinel` integration test expects `attackIntervalMs: 1500` on the spawned minion object.
- Test passes with current cardStats and documents that sentinel shares the guardian spawn factory defaults.
