# Apply the 3 optional apply-now tunes (ice_ball, purifying_pulse, chain_lightning)

Apply the three small, low-risk numeric nudges the 303 card-balance pass identified as optional apply-now but did not auto-apply, then mark them applied in the balance report. These are conservative data-only tweaks — no design changes, no code/logic changes.

The three changes (exactly as recommended in `game/validation/card-balance/report.md`):
- `ice_ball` — `slowChance` 0.5 → 0.65
- `purifying_pulse` — `healAmount` 15 → 20
- `chain_lightning` — `magicStoneCost` 42 → 37

## Acceptance Criteria

- `game/shared/cardStats.json` `ice_ball.slowChance` is `0.65` (was `0.5`); no other `ice_ball` fields change.
- `game/shared/cardStats.json` `purifying_pulse.healAmount` is `20` (was `15`); no other `purifying_pulse` fields change.
- `game/shared/cardStats.json` `chain_lightning.magicStoneCost` is `37` (was `42`); no other `chain_lightning` fields change.
- No other card's stats change; no changes to `cardEconomy.json` (the report does not recommend any economy change for these three).
- `game/validation/card-balance/report.md` is updated so all three cards read as applied/done rather than optional/deferred:
  - The `### apply-now` recommendations table rows for `ice_ball`, `purifying_pulse`, `chain_lightning` change status from `optional` to a `**done**` / applied marker.
  - The `## Applied tunings` section lists the three new changes with `before → after` values (`slowChance` 0.5→0.65, `healAmount` 15→20, `magicStoneCost` 42→37).
  - These three are removed from (or re-marked applied in) the `**Deferred — no safe change identified**` table so they are no longer listed as deferred.
  - The relevant spell-table rows / spotlight `Recommendation` lines for these three no longer describe the tune as a pending "then `apply-now`" option.
- Existing tests are updated to the new values and the full suite passes:
  - `server/test/ice_ball_card.test.js` asserts `slowChance: 0.65`.
  - `server/test/card_balance_metrics.test.js` asserts `chain_lightning.magicStoneCost: 37` and `purifying_pulse.utilityScore: 20`.
- `pnpm test` (run from `game/`) passes.

## Technical Specs

- `game/shared/cardStats.json`:
  - `ice_ball.slowChance`: `0.5` → `0.65`
  - `purifying_pulse.healAmount`: `15` → `20`
  - `chain_lightning.magicStoneCost`: `42` → `37`
- `game/validation/card-balance/report.md`: update the `### apply-now (small numeric tweaks)` table (the three optional rows), the `## Applied tunings` table (add the three rows), the `**Deferred — no safe change identified**` table (drop/re-mark the three), and the per-card spotlight `Recommendation:` lines + spell-table `recommendation` cells so they no longer present the change as still-optional. Also update the `## Executive summary` / `Ticket 303 sub-ticket 04 scope` bullet that currently says "3 optional `apply-now` remain (ice_ball, purifying_pulse, chain_lightning)" to reflect they are now applied.
- Tests (these hardcode the old values and will fail unless updated):
  - `game/server/test/ice_ball_card.test.js` — the `toMatchObject` at the top asserts `slowChance: 0.5`; change to `0.65`.
  - `game/server/test/card_balance_metrics.test.js` — `report.cards.chain_lightning` asserts `magicStoneCost: 42` (→ `37`); `report.cards.purifying_pulse` asserts `utilityScore: 15` (→ `20`, since `utilityScore` derives from `healAmount`).
  - Grep the repo for any other hardcoded occurrences of these old values for these three cards before finalizing (e.g. `slowChance`, `healAmount`, chain_lightning `magicStoneCost`) to avoid missed test breakage.
- Do NOT change `cardDefs.json`, simulation/effect logic, or any other card. Keep the diff to the three JSON values, the report, and the two test files.

## Verification: code
