# Card balance metrics test

Add a reproducible card-balance metrics layer that loads every card from the shared JSON sources and computes comparable power/economy proxies (damage per charge, MS-adjusted burst, minion DPS estimate, sell-value ratio, reward-order slot). This gives the roster analysis a concrete, test-backed foundation before writing recommendations.

## Acceptance Criteria

- New vitest module `game/server/test/card_balance_metrics.test.js` loads `cardDefs.json`, `cardStats.json`, and `cardEconomy.json` and asserts every card id has matching entries in all three (same key set as `CARD_DEFS`).
- The test exports or asserts a per-card metrics record containing at minimum: `id`, `type`, `charges`, `magicStoneCost`, `acquisition`, `rewardOrder`, `sellValue`, `directDamage`, `estimatedBurstDamage`, and `damagePerMsStone` (use `0` MS cost as a documented sentinel, not `Infinity`).
- Burst estimation covers the main stat shapes in `cardStats.json`: flat `damage`, DoT fields (`dotTicks` × tick damage), `frozenBonusDamage`, minion `attackDamage`/`attackIntervalMs`/`minionTtl`, enchantment `damage`/`damagePerTick`, and heal/support cards use a documented non-damage `utilityScore` instead of forcing zero.
- The test asserts `rewardOrder` values are unique among `acquisition: "reward"` cards and flags cards whose metrics fall outside documented peer bands (weapons/spells/creatures/enchantments grouped separately; MS tiers at 0 / 1–35 / 36–50 / 51+).
- `game/validation/card-balance/` directory exists with a `metrics-snapshot.json` (generated or checked in by the test) listing all card ids and computed metrics for the report author to reference.
- `cd game && pnpm test:quick -- card_balance_metrics` passes.

## Technical Specs

- **`game/server/test/card_balance_metrics.test.js`** (new): import shared JSON directly (same pattern as `card_acquisition.test.js`). Implement small pure helpers at the top of the file or in a colocated `game/server/test/helpers/cardBalanceMetrics.js` if the logic exceeds ~120 lines.
- **`game/validation/card-balance/metrics-snapshot.json`** (new): JSON array or `{ cards: { … } }` map keyed by card id; written via a test helper or committed static output the test compares against with a clear diff on drift.
- **`game/shared/cardDefs.json`**, **`game/shared/cardStats.json`**, **`game/shared/cardEconomy.json`**: read-only for this sub-ticket — no stat changes.
- Document peer-band thresholds in test `describe` comments (reference ticket 207 bands: ~17% over T2 ceiling = over-budget, below tier floor = under-budget).
- Do **not** write `report.md` or change card stats in this sub-ticket.

## Verification: code
