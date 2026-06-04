# Glacier Rupture: cap frozen bonus damage

Lower `glacier_collapse` `frozenBonusDamage` from 44 to 33 so evolved frost shatter damage sits within the T2 spell band (~17% over ceiling). Pin the new value in tests. No freeze/shatter engine changes.

## Acceptance Criteria

- `CARD_DEFS.glacier_collapse.frozenBonusDamage` is `33` in `game/server/progression.js` (was `44`).
- `game/server/test/new_card_pack.test.js` documents the new stat (e.g. `toMatchObject({ frozenBonusDamage: 33, … })` on `CARD_DEFS.glacier_collapse`, or an explicit `expect(def.frozenBonusDamage).toBe(33)` in the Glacier Rupture test).
- The existing `'Glacier Rupture deals bonus damage to already-frozen enemies'` test still passes with HP math driven from `def.damage` and `def.frozenBonusDamage` (frozen enemy ends at `100 - def.damage - def.frozenBonusDamage`).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/progression.js`: in the `glacier_collapse` entry (~L289–298), change `frozenBonusDamage: 44` to `frozenBonusDamage: 33`. Leave `damage`, `magicStoneCost`, `freezeDurationMs`, and `isEvolved` unchanged.
- `game/server/test/new_card_pack.test.js`: extend `'Glacier Rupture deals bonus damage to already-frozen enemies'` (or add a sibling assertion) so the rebalance is not silent — assert `frozenBonusDamage === 33` on the def used by the test.
- Do **not** modify `applyFreezeInRadius`, `cardEffects.js`, or client card mirrors.

## Verification: code
