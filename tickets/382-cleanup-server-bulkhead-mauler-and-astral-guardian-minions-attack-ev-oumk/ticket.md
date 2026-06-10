# Cleanup nits from server-bulkhead-mauler-and-astral-guardian-minions-attack-ev-oumk

> **Staleness note.** This follow-up ticket was written against commit
> `d01f7ec1` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `server-bulkhead-mauler-and-astral-guardian-minions-attack-ev-oumk`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stale astral_guardian overlay entry in card-balance analyzer

`game/validation/card-balance/analyzeCards.mjs` still lists `astral_guardian: ['attackIntervalMs']` in `SERVER_STAT_OVERLAY`, but `attackIntervalMs` was moved into shared `cardStats.json` and removed from `progression.js` CARD_STAT_OVERLAY. The analyzer doc should drop that entry so balance reports don't imply a server-only computed interval.

### Acceptance Criteria
- `SERVER_STAT_OVERLAY` in `analyzeCards.mjs` no longer includes `attackIntervalMs` for `astral_guardian`
- Card-balance validation still passes for `astral_guardian`

## Stale TICK_RATE comment in card_sync.test.js

`game/server/test/card_sync.test.js` still describes `astral_guardian`'s `attackIntervalMs` as "TICK_RATE-derived" in the SERVER_ONLY_OVERLAY_KEYS comment. Update the comment to reflect that `attackIntervalMs` is now a normal shared stat from `cardStats.json`.

### Acceptance Criteria
- Comment accurately describes which fields are server-only overlays vs shared stats
- `card_sync.test.js` still passes

## bulkhead_mauler spawn omits explicit attackIntervalMs on minion object

The `bulkhead_mauler` branch in `cardEffects.js` (~1337) sets range/cone/damage but not `attackIntervalMs` or `lastAttackAt`, unlike `null_crawler` which copies interval fields at spawn. Behavior is correct today because `updateMinions` defaults to 1500 ms, but explicit copy from `cardDef` would match other combat minions and survive a future default change.

### Acceptance Criteria
- Spawned `bulkhead_mauler` minions carry `attackIntervalMs` from `CARD_DEFS` and `lastAttackAt: 0` (or `now - attackIntervalMs` if first-swing-immediate is desired)
- Existing mauler tests still pass

## Misleading astral_guardian test title

`astral_guardian.test.js` test `"astral guardian minion deals more damage per tick than default minions"` still says "per tick" though attacks are now interval-gated at 1500 ms. Rename to reflect per-attack or per-interval wording.

### Acceptance Criteria
- Test name describes interval-gated attack behavior, not per-tick damage
- Test logic and assertions unchanged
