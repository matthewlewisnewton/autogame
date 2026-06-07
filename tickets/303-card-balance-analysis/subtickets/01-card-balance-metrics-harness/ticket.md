# Card balance metrics harness

Add a small analysis script under `game/validation/card-balance/` that loads `cardDefs.json`, `cardStats.json`, and `cardEconomy.json`, merges identity + stats the same way `progression.js` does, and emits normalized per-card metrics (type, charges, damage, MS cost, cooldown, sell value, acquisition/rewardOrder, derived burst-per-charge and damage-per-MS proxies). Include a vitest that runs the script and asserts every card id has a metrics row with no gaps.

## Acceptance Criteria

- `game/validation/card-balance/analyzeCards.mjs` exists, runs with `node game/validation/card-balance/analyzeCards.mjs`, and prints or writes structured metrics for **all** keys in `game/shared/cardDefs.json` (currently 47 cards).
- Each metrics row includes at minimum: `id`, `name`, `type`, `charges`, `magicStoneCost`, `damage` (or primary combat stat proxy for creatures/enchantments), `cooldownMs`, `sellValue`, `acquisition`, `rewardOrder`, and at least one derived field (`damagePerCharge`, `damagePerMs`, or type-appropriate utility score).
- `game/server/test/card_balance_metrics.test.js` imports or spawns the analyzer and fails if any `cardDefs` id is missing from output or if `cardStats` / `cardEconomy` keys referenced by defs are absent.
- `cd game && pnpm test:quick` passes with the new test included in the server suite.

## Technical Specs

- **`game/validation/card-balance/analyzeCards.mjs`**: read shared JSON via `fs` + `path` from repo-relative paths; merge `cardDefs[id]` + `cardStats[id]`; attach `sellValue` from `cardEconomy.cardSellValues[id]` when present; compute simple derived metrics (e.g. weapon `damagePerCharge = damage * (swingsPerUse ?? 1)`, spell `effectiveBurst = damage + dot contribution estimate where fields exist`).
- **`game/server/test/card_balance_metrics.test.js`**: spawn or import the analyzer; compare output keys to `Object.keys(cardDefs)` sorted; smoke-check a few known cards (`iron_sword`, `fireball`, `ice_ball`, `chain_lightning`, `purifying_pulse`, `dungeon_drake`) expose expected raw fields.
- Do **not** change card data, write `report.md`, or modify gameplay code in this sub-ticket.
- Reference `game/server/progression.js` `CARD_DEFS` merge pattern; note server-only overlay fields (`CARD_STAT_OVERLAY`) are optional in metrics but document which cards use them.

## Verification: code
