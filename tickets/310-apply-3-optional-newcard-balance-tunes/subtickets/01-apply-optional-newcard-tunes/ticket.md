# Apply the 3 optional new-card balance tunes (ice_ball, purifying_pulse, chain_lightning)

Apply the three optional `apply-now` numeric nudges the 303 card-balance pass identified
but deferred for ice_ball, purifying_pulse, and chain_lightning. These are small, low-risk
data-only stat changes plus a report update and one test-fixture sync. No design changes.

## Acceptance Criteria

- `game/shared/cardStats.json` → `ice_ball.slowChance` is `0.65` (was `0.5`); all other ice_ball fields unchanged.
- `game/shared/cardStats.json` → `purifying_pulse.healAmount` is `20` (was `15`, +5); all other purifying_pulse fields unchanged.
- `game/shared/cardStats.json` → `chain_lightning.magicStoneCost` is `37` (was `42`, −5); all other chain_lightning fields unchanged.
- No other card stats in `cardStats.json` are modified.
- `game/validation/card-balance/report.md` is updated so these three rows are marked applied/done rather than "optional"/"Deferred": the `### apply-now` table status column reads done for all three; the "Deferred — no safe change identified" table no longer lists ice_ball, purifying_pulse, or chain_lightning (the dungeon_drake row stays); and the "Applied tunings" table gains rows for the three changes with their before → after values. The executive-summary line stating "3 optional `apply-now` remain (ice_ball, purifying_pulse, chain_lightning)" is updated to reflect they are now applied.
- `game/server/test/ice_ball_card.test.js` expects `slowChance: 0.65` (fixture synced to the new value).
- The full test suite passes (`pnpm test` from `game/`), including `ice_ball_card.test.js`, `purifying_pulse.test.js`, and `chain_lightning.test.js`.

## Technical Specs

- `game/shared/cardStats.json`:
  - `ice_ball`: `slowChance` `0.5` → `0.65`.
  - `purifying_pulse`: `healAmount` `15` → `20`.
  - `chain_lightning`: `magicStoneCost` `42` → `37`.
- `game/server/test/ice_ball_card.test.js`: the `toMatchObject` assertion at ~line 31 hardcodes `slowChance: 0.5`; change it to `0.65`. (`purifying_pulse.test.js` and `chain_lightning.test.js` read values dynamically from `CARD_DEFS`, so they need no edits — verify this still holds.)
- `game/validation/card-balance/report.md`: update the `### apply-now` table (lines ~283–285), the "Deferred — no safe change identified" table (lines ~330–332), the "Applied tunings" table (add three rows), and the executive-summary bullet (~line 268) per the acceptance criteria. Keep the wording consistent with the existing "done — see Applied tunings" rows.
- Do not touch `cardEconomy.json` — none of these three tunes involve sell/economy values.

## Verification: code
