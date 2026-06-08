# Phase Stalker slower grind scaling

Apply the per-card grind scale from sub-ticket 01 to `null_crawler` (Phase Stalker) so its combat minion stats taper at high grind while reward:12 base power stays intact. Wire `attackDamage` through `scaledGrindStat` with `cardId` — it currently spawns at raw `cardDef.attackDamage` and does not scale with grind.

## Acceptance Criteria

- `CARD_GRIND_STAT_SCALE.null_crawler` is set to a conservative value below `GRIND_STAT_SCALE` (match or slightly align with `battle_familiar` — e.g. 0.03).
- `null_crawler` at grind 0: `attackDamage` **22**, `minionHp` **55** (base `cardStats.json` values).
- `null_crawler` at grind 5+: `attackDamage` and `minionHp` at spawn are **strictly lower** than default global-scale would produce; beam damage in combat reflects scaled `attackDamage`.
- `game/shared/cardStats.json` base values for `null_crawler` are **unchanged**.
- `game/server/test/creature_minions.test.js` (or adjacent minion test) includes grind-scaling assertions for Phase Stalker spawn/beam damage.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`**: add `null_crawler` entry to `CARD_GRIND_STAT_SCALE` (infrastructure from 01 must already exist).
- **`game/server/cardEffects.js`**: in the `null_crawler` spawn block (`~line 1213`), set `minion.attackDamage = scaledGrindStat(cardDef.attackDamage || 22, grind, 'null_crawler')`; ensure generic minion HP spawn passes `'null_crawler'` to `scaledGrindStat` for `minionHp` / `minionTtl`.
- **`game/server/simulation.js`**: no logic changes expected — minion uses spawned `attackDamage`.
- **`game/server/test/creature_minions.test.js`**: extend `makeStalker()` helper or add grind-variant cases; update hardcoded HP expectations only where grind > 0 is tested.
- Do **not** change `battle_familiar` scale values or `astral_guardian` in this sub-ticket.

## Verification: code
