# 207-gameplay-card-balance-pass

## Difficulty: medium

## Goal

Rebalance three cards that fall outside their power-budget band (per the card-balance framework). Data-only tweaks in game/server/progression.js plus their tests — no behavior/engine code changes.

## Acceptance Criteria

- 1. glacier_collapse: frozenBonusDamage 44 -> 33 (game/server/progression.js, ~L295) — it sits ~17% over the T2 band ceiling, out-classing 65-stone capstones on raw clear.
- 2. arcane_bolt: damage 15 -> 20 (~L275) — below floor; strictly worse than its peers.
- 3. mirror_ward: reflectRange 8 -> 11 (~L451) — under floor; single-attacker spite -> area deterrence.
- 4. Update/extend the affected card tests to the new values.
- 5. Full server+client vitest green.

## Verification

Framework: glacier_collapse over-budget on Damage; arcane_bolt and mirror_ward under their tier floor. Keep changes pure-data (CARD_DEFS field values); no changes to effect-resolution code.
