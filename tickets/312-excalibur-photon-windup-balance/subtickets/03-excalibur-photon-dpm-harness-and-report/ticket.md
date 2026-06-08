# Excalibur Photon effective DPM harness and balance report

Teach the card-balance metrics harness to treat `windUpMs` as part of sustained cycle time, then reconcile the balance report so `excalibur_photon` is no longer flagged as a runaway DPM outlier while per-hit burst stays unchanged.

## Acceptance Criteria

- `game/validation/card-balance/analyzeCards.mjs` computes `damagePerMs` using **effective cycle** `cooldownMs + (windUpMs || 0)` (not `cooldownMs` alone) for cards that define `windUpMs`.
- For live stats, `excalibur_photon` effective `damagePerMs` is **≤ 0.046** (~1.5× weapon Q3 `0.031`) and **≥ 0.030** (`saber_of_light` lane — still feels like an evolution upgrade).
- `excalibur_photon` primary burst in metrics remains **14×2** (per-hit damage unchanged); only sustained efficiency drops.
- `game/server/test/card_balance_metrics.test.js` adds an assertion on `report.cards.excalibur_photon.damagePerMs` within the band above (and documents the formula in a brief comment).
- `game/validation/card-balance/report.md` updates the `excalibur_photon` weapons table row, weapon outlier note #2, `## Recommendations` operator-triage row, and `## Applied tunings` to reflect the `windUpMs` tuning (mark done / remove from active triage backlog).
- Other cards with existing `windUpMs` (e.g. `steel_claymore`, `magma_greatsword`) may show lower harness DPM in the report — update their table DPM cells only; do not retune those cards.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/validation/card-balance/analyzeCards.mjs`**: in `computeDerivedMetrics`, derive `effectiveCycleMs = (merged.cooldownMs ?? DEFAULT_COOLDOWN_MS) + (merged.windUpMs ?? 0)`; set `damagePerMs = perUseDamage / effectiveCycleMs` when `effectiveCycleMs > 0`. Export or inline-document the formula so tests stay in sync.
- **`game/server/test/card_balance_metrics.test.js`**: assert `report.cards.excalibur_photon.damagePerMs` satisfies `>= 0.030 && <= 0.046`; optionally assert `effectiveBurst` / per-swing damage still reflects `14` and `swingsPerUse: 2`.
- **`game/validation/card-balance/report.md`**: regenerate `excalibur_photon` DPM/DPC cells from `node game/validation/card-balance/analyzeCards.mjs` output; change verdict from `over` to `ok` if metrics land in weapon peer band; add applied-tuning row `excalibur_photon | windUpMs | — → <value> | wind-up recovery lock; per-hit damage unchanged`.
- **`game/shared/cardStats.json`**: read-only unless sub-ticket 01 is incomplete — do not change `damage`, `cooldownMs`, or `swingsPerUse`.
- Do **not** edit gameplay server/client code beyond the metrics harness and report.

## Verification: code
