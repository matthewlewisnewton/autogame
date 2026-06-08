# Wind-up-aware effective DPM in balance harness

Extend the card-balance metrics harness so `damagePerMs` reflects real sustained uptime for cards with `windUpMs`. Today `analyzeCards.mjs` divides per-use damage only by `cooldownMs`, which overstates spammy weapons like `excalibur_photon`. Add an effective cycle of `cooldownMs + windUpMs` (when `windUpMs > 0`) without changing any live card stats yet.

## Acceptance Criteria

- `game/validation/card-balance/analyzeCards.mjs` computes `damagePerMs` using `effectiveCycleMs = cooldownMs + (windUpMs || 0)` for cards that define `windUpMs`; cards without `windUpMs` keep the existing formula.
- `game/server/test/card_balance_metrics.test.js` documents the formula with at least one exemplar: `magma_greatsword` effective DPM is lower than its cooldown-only DPM, and `iron_sword` is unchanged.
- `excalibur_photon` metrics row still reflects pre-tune dominance (no `windUpMs` yet) so sub-ticket 02 has a clear before/after target.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/validation/card-balance/analyzeCards.mjs`**: in `computeDerivedMetrics`, read `merged.windUpMs`; when positive, set `effectiveCycleMs = cooldownMs + windUpMs` and `damagePerMs = perUseDamage / effectiveCycleMs`. Optionally expose `effectiveCycleMs` or `windUpMs` on the metrics row for tests (keep exported shape backward-compatible for existing smoke checks).
- **`game/server/test/card_balance_metrics.test.js`**: add assertions on `report.cards.magma_greatsword.damagePerMs` vs a cooldown-only baseline, and confirm `report.cards.iron_sword.damagePerMs` is unchanged.
- Do **not** edit `game/shared/cardStats.json`, server combat logic, or client code in this sub-ticket.

## Verification: code
