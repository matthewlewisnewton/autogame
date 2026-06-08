# Reconcile report.md spell summary + spotlight to applied optional tunes

Sub-ticket 01 applied the three optional `apply-now` nudges in `cardStats.json`
(ice_ball `slowChance` 0.5→0.65, purifying_pulse `healAmount` 15→20,
chain_lightning `magicStoneCost` 42→37) and updated the "Applied tunings" and
"apply-now" tables. The **spell summary table**, the **spotlight sections**, and
a few inline references still show the stale pre-tune values and conditional
"if underused, apply-now…" wording. Reconcile those remaining sections so the
report consistently reflects the applied (done) state. No JSON or gameplay
changes — documentation only.

## Acceptance Criteria

- The Spells summary table row for `chain_lightning` shows MS cost **37** (was
  42).
- The `ice_ball` spotlight section shows the slow as **65% / 0.65 factor** (not
  50% / 0.5), and its recommendation reads as **applied/done** (sub-ticket 310),
  not a conditional "raise `slowChance` to 0.65".
- The `chain_lightning` spotlight section shows MS cost **37** (was 42) in its
  stat table, and its recommendation reads as **applied/done** (sub-ticket 310),
  not a conditional "−5 MS cost".
- The `purifying_pulse` spotlight section shows **20 HP** heal and
  **utilityScore 20** (was 15), and its recommendation reads as
  **applied/done** (sub-ticket 310), not a conditional "+5 heal".
- No remaining text in `report.md` states these three nudges as *optional /
  pending / "if underused"*; any lingering inline reference to the old values
  (e.g. the cleanse-combo note `healAmount (15)`) is updated to the new value
  or otherwise reconciled.
- No changes to any file other than `game/validation/card-balance/report.md`;
  the three `cardStats.json` values are unchanged (slowChance 0.65,
  healAmount 20, magicStoneCost 37).
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- Edit **only** `game/validation/card-balance/report.md`.
- Spells summary table (`## Spells`): update the `chain_lightning` row MS-cost
  cell from `42` to `37`. (DPM is `burst/cooldown` and does not change.)
- Spotlight `### ice_ball (294) — spell`: change the Utility row from
  `50% slow, 3 s, 0.5 factor` to `65% slow, 3 s, 0.65 factor`; rewrite the
  **Recommendation** line to reflect the applied bump (slowChance 0.5 → 0.65,
  sub-ticket 310) instead of the conditional "then `apply-now` raise…".
- Spotlight `### chain_lightning (302) — spell`: change the MS-cost stat row
  from `42` to `37` (and adjust the peer-context phrasing about "highest MS
  among spotlight cards" if it no longer holds); rewrite the **Recommendation**
  line to reflect the applied −5 MS (42 → 37, sub-ticket 310).
- Spotlight `### purifying_pulse (299) — spell`: change `Heal | 15 HP` to
  `20 HP`, change the `utilityScore 15` reference to `20`, and rewrite the
  **Recommendation** line to reflect the applied +5 heal (15 → 20,
  sub-ticket 310).
- Degenerate combos table: update the "Cleanse attrition counter" note
  `reduce healAmount (15)` to `(20)`.
- Leave the already-correct "Applied tunings" table, the "apply-now" table, and
  the Executive summary line (which already credit sub-ticket 310) intact.

## Verification: code
