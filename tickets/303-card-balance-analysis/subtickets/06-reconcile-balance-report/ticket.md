# Reconcile balance report with live card stats

After sub-tickets 04 and 05, `game/shared/cardStats.json` holds the final applied tunings but `game/validation/card-balance/report.md` still lists pre-tuning metrics in its primary tables, outlier bullets, spotlight comparisons, and executive summary. Regenerate or manually reconcile every affected row so the committed report accurately describes the live roster.

## Acceptance Criteria

- Run `node game/validation/card-balance/analyzeCards.mjs` (or import it in a one-off script) against the current shared JSON and use its output as the source of truth for numeric fields in the report tables.
- Every per-card row in `## Weapons`, `## Spells`, `## Creatures`, and `## Enchantments` matches live merged stats for at least: primary damage/burst, derived efficiency (`damagePerCharge`, `damagePerMs`, or type-appropriate proxy), and verdict labels that follow the updated peer bands.
- The five `apply-now` tunings are reflected with post-tuning values: `saber_of_light` (12), `fireball` (18), `harvesting_scythe` (12), `permafrost_lance` (11), `dragons_breath` (13).
- `excalibur_photon` table row and outlier notes show **14×2** (reverted in sub-ticket 05), not 18×2; its verdict remains `over` / `operator-triage`.
- `## New/changed cards (294–302 spotlight)` peer comparisons cite post-tuning values where applicable (e.g. `fireball` impact 18, `permafrost_lance` 11).
- `## Executive summary` no longer lists the five applied cards under **under** outliers; it reflects their post-tuning verdicts.
- `## Applied tunings` section is unchanged except where sub-ticket 05 already corrected excalibur notes — do not reintroduce stale pre-tuning language.
- All 47 card ids still appear exactly once across type tables; no edits to `game/shared/card*.json` or gameplay code.
- `cd game && pnpm test:quick` passes (including `card_balance_metrics.test.js`).

## Technical Specs

- **`game/validation/card-balance/report.md`**: update primary tables, numbered outlier lists under each type section, spotlight subsections (`fireball`, `ice_ball`, `chain_lightning`, `purifying_pulse`, `dungeon_drake`), economy cross-references that embed stale damage values, and `## Executive summary`.
- **`game/validation/card-balance/analyzeCards.mjs`**: read-only reference; use existing derived-metric formulas (`damagePerCharge`, `damagePerMs`, `effectiveBurst`) — do not change card data or harness logic unless a bug blocks accurate output.
- **Peer-band / verdict rules**: re-evaluate `ok` / `over` / `under` / `dead` against same-type peers using post-tuning numbers; move applied cards out of **under** lists when metrics now sit in band.
- **`## Recommendations`**: keep existing `apply-now` vs `operator-triage` split; mark the five applied items as done (reference `## Applied tunings`) without deleting triage backlog entries.
- Do **not** apply new JSON tunings or edit `game/server/cardEffects.js` / `simulation.js`.

## Verification: code
