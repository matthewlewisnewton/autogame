# Reconcile 303 card-balance report for ticket 311 tunings

After sub-tickets 01–03, update `game/validation/card-balance/report.md` so operator-triage rows and executive summary for `battle_familiar`, `null_crawler`, and `astral_guardian` reflect the live roster. Document grind-scaling changes for the two early/mid cards and base-stat trim for Astral Guardian. No further gameplay code or JSON tuning — report reconciliation only.

## Acceptance Criteria

- `## Applied tunings` (or a new `## Ticket 311 tunings` subsection) documents each change: `battle_familiar` and `null_crawler` slower per-grind scale (note `CARD_GRIND_STAT_SCALE` values and that base `cardStats` unchanged); `astral_guardian` before → after for trimmed field(s).
- Primary tables / outlier bullets for **Signal Familiar**, **Phase Stalker**, and **Astral Guardian** show post-tuning base metrics (`astral_guardian` damage/shield from live `cardStats.json`; note that familiar/stalker harness rows reflect grind-0 bases while late power is reduced via scaling).
- `operator-triage` entries for these three cards are annotated **addressed in 311** (or moved to applied) with a one-line rationale; do not delete unrelated triage backlog.
- Re-run `node game/validation/card-balance/analyzeCards.mjs` (or import in test) to verify `astral_guardian` table numbers match live JSON; grind-scale cards keep grind-0 harness numbers.
- No edits to `game/shared/card*.json`, `progression.js`, or `cardEffects.js`.
- `cd game && pnpm test:quick` passes (including `card_balance_metrics.test.js`).

## Technical Specs

- **`game/validation/card-balance/report.md`**: update `## Spells` / `## Creatures` rows, numbered outlier lists, `### operator-triage` table, and `## Executive summary` for the three cards; append tuning notes to `## Applied tunings`.
- **`game/validation/card-balance/analyzeCards.mjs`**: read-only reference for numeric reconciliation.
- **`game/server/test/card_balance_metrics.test.js`**: update smoke-check literals only if `astral_guardian` base damage changed in sub-ticket 03.
- Do **not** apply new balance changes beyond what 01–03 already committed.

## Verification: code
