# Apply safe card balance tunings

Implement only the `apply-now` recommendations from `game/validation/card-balance/report.md` as low-risk, data-only changes in the shared card JSON files. Update affected server test expectations, add a short `## Applied tunings` section to the report, and leave all `operator-triage` items unchanged. Do not modify effect-resolution or simulation logic unless a recommendation explicitly requires it (expected: none).

## Acceptance Criteria

- Every `apply-now` item in the report is either applied in shared JSON **or** marked `deferred — no safe change identified` with a one-line reason in `## Applied tunings`.
- Changes are limited to `game/shared/cardStats.json`, `game/shared/cardDefs.json`, and/or `game/shared/cardEconomy.json` (charges, numeric stats, sell values, rewardOrder only — no new effects).
- Hardcoded stat assertions in affected tests are updated (e.g. `fireball_card.test.js`, `ice_ball_card.test.js`, `chain_lightning.test.js`, `purifying_pulse.test.js`, `vault_wyrm_burning.test.js`, `new_card_pack.test.js`, `card_sync.test.js` — only files touched by the chosen tunings).
- `game/validation/card-balance/report.md` gains `## Applied tunings` listing each applied change (before → after) and references the unchanged `operator-triage` backlog.
- `cd game && pnpm test:quick` passes; no client-side card copy drift (`card_sync.test.js` green).

## Technical Specs

- **`game/shared/cardStats.json`**: primary target for damage, MS cost, cooldown, minion combat fields, hazard numbers.
- **`game/shared/cardDefs.json`**: only if an `apply-now` item adjusts `charges`, `acquisition`, or `rewardOrder`.
- **`game/shared/cardEconomy.json`**: only for `apply-now` sell-value or evolution mapping fixes flagged in the report.
- **`game/validation/card-balance/report.md`**: append `## Applied tunings`; do not remove analysis tables or triage recommendations.
- **`game/server/test/*`**: update `toMatchObject` / literal expectations for changed values; do not weaken assertions to unrelated defaults.
- Do **not** edit `game/server/cardEffects.js`, `game/server/simulation.js`, or client render code unless the report's `apply-now` list explicitly requires it (default: forbid).

## Verification: code
