# Per-card grind scale + Signal Familiar slower scaling

Add a per-card grind stat scale map in `progression.js` and extend `getStatMultiplier` / `scaledGrindStat` to accept an optional `cardId`, falling back to the global `GRIND_STAT_SCALE` (0.05). Apply a conservative slower scale for `battle_familiar` so grind 0 burst/minion stats stay at base (`damage` 44, default `minionHp`) but high-grind values grow less than peers. Thread `cardId` through the summon/radial and astral-shield cast paths in `cardEffects.js` that already call `scaledGrindStat` for this card.

## Acceptance Criteria

- `CARD_GRIND_STAT_SCALE` (or equivalent) exists in `progression.js` with `battle_familiar` set to a value **below** `GRIND_STAT_SCALE` (e.g. 0.03 — conservative, not gutting).
- `scaledGrindStat(base, grind)` without `cardId` is unchanged for all other cards (e.g. `iron_sword` at grind 5 still `round(base * 1.25)`).
- `battle_familiar` at grind 0: burst damage remains **44**; minion HP at spawn matches unscaled `cardStats` base.
- `battle_familiar` at grind 5+: scaled damage and minion HP are **strictly lower** than the default global scale would produce at the same grind.
- `game/shared/cardStats.json` base values for `battle_familiar` are **unchanged** (`damage` 44, `magicStoneCost` 50).
- New or updated unit tests in `game/server/test/card_grinding.test.js` (or a focused battle-familiar grind test) assert the per-card multiplier behavior.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`**: add `CARD_GRIND_STAT_SCALE` map; extend `getStatMultiplier(grind, cardId?)` and `scaledGrindStat(baseValue, grind, cardId?)`; export if needed by tests.
- **`game/server/cardEffects.js`**: pass `data.cardId` (or equivalent) as the third argument to every `scaledGrindStat` call on paths used by `battle_familiar` — radial summon burst (`~line 1037`), minion HP/TTL spawn (`~line 1182`), and `applyAstralShieldCast` if shared with evolved forms (only apply card-scoped scale when `cardId` is `battle_familiar`).
- **`game/server/index.js`**: re-export new symbols only if existing test imports require it.
- **`game/server/test/card_grinding.test.js`**: add cases for per-card scale vs default; do not weaken existing global-scale assertions.
- Do **not** change `null_crawler`, `astral_guardian`, or `cardStats.json` in this sub-ticket.

## Verification: code
