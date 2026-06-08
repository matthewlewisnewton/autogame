# Balance report reconciliation for heavy-hitter wind-up tuning

Document the ticket 308 wind-up + charge pass in the 303 balance report so `flame_blade`, `magma_greatsword`, and `soul_drain` are no longer open `operator-triage` wind-up/charge backlog items. Depends on sub-tickets 01–03.

## Acceptance Criteria

- `game/validation/card-balance/report.md` **Applied tunings** table adds rows for:
  - `flame_blade`: `windUpMs` none → 650, `charges` 3 → 2.
  - `magma_greatsword`: `charges` 4 → 2 (note `windUpMs` 800 already from 307).
  - `soul_drain`: `windUpMs` none → 700 (`charges` unchanged at 1).
- Weapons table rows for `flame_blade` and `magma_greatsword` mark verdict **done** (or note wind-up + charge tuning applied) with effective DPM/DPC after wind-up-aware harness.
- Spells table row for `soul_drain` notes wind-up commitment applied; remove or strike the open `operator-triage` bullet for these three cards in **Recommendations → operator-triage**.
- Executive summary / cross-references mention ticket **308** alongside 312 (`excalibur_photon`) for wind-up balance.
- `cd game && pnpm test:quick` still passes (report-only change should not break tests; run as sanity check).

## Technical Specs

- **`game/validation/card-balance/report.md`** only — edit:
  - `## Applied tunings` — three new rows with before → after and harness DPM notes.
  - `## Weapons` table — update `flame_blade` and `magma_greatsword` recommendation column.
  - `### Weapon outlier notes` — mark items 1 (`magma_greatsword`) and 4 (`flame_blade`) addressed.
  - `## Spells` / `### Spell outlier notes` — mark `soul_drain` addressed.
  - `## Recommendations → operator-triage` — remove or annotate `flame_blade`, `magma_greatsword`, `soul_drain` rows.
  - `## Executive summary` — one bullet on 308 scope.
- Optionally regenerate metrics via `node game/validation/card-balance/analyzeCards.mjs` to copy accurate post-tune DPC/DPM into the table; do not change JSON in this sub-ticket.
- No gameplay code changes.

## Verification: code
