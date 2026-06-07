# Creatures, enchantments, economy & combos report (part 2)

Complete `game/validation/card-balance/report.md` by adding creature, enchantment, and economy tables, degenerate combo analysis, and an executive summary. Include explicit analysis of rebalanced `dungeon_drake` / Vault Wyrm (298). Every card in the roster must appear exactly once across the full report; finalize `apply-now` vs `operator-triage` recommendations for sub-ticket 04. Still no JSON tuning in this sub-ticket.

## Acceptance Criteria

- `game/validation/card-balance/report.md` adds sections: `## Creatures`, `## Enchantments`, `## Economy & acquisition`, `## Degenerate combos`, `## Executive summary`, `## Recommendations`.
- Every card id in `game/shared/cardDefs.json` appears in exactly one type table across the full report (weapons + spells from sub-ticket 02 plus creatures + enchantments here).
- `dungeon_drake` (Vault Wyrm, ticket 298) has a dedicated note covering `attackDamage`, `burnDurationMs`, `burning_breath` breath DPS vs peer creatures and vs `ancient_wyrm` evolution.
- `## Degenerate combos` lists at least two plausible multi-card interactions (e.g. MS engine + spender loops, pull + hazard, heal/cleanse + attrition) with severity (`low` / `medium` / `high`) and whether a data-only fix is feasible.
- `## Recommendations` consolidates all `apply-now` items (expected: small numeric tweaks only) separately from `operator-triage` items; each entry names the exact JSON field(s) to change.
- No edits to `game/shared/card*.json`, tests, or gameplay code.

## Technical Specs

- **`game/validation/card-balance/report.md`**: extend the file from sub-ticket 02; remove stub headings once filled.
- **Creature stats**: use minion fields from `cardStats.json` (`minionHp`, `attackDamage`, `breathDamage`, `minionTtl`, taunt/shield/specialEffect) and server overlay notes from `game/server/progression.js` `CARD_STAT_OVERLAY`.
- **Enchantments**: `spike_trap`, `mirror_ward`, `cinder_snare` — compare hazard DPS, reflect range/scale, MS cost vs spell peers.
- **Economy**: `game/shared/cardEconomy.json` `cardSellValues` and `evolutionTransforms`; flag cards with missing sell values or rewardOrder gaps vs acquisition `reward`.
- **Combo research**: skim `game/server/cardEffects.js`, `game/server/simulation.js` minion/MS restore paths, and existing tests (`vault_wyrm_burning.test.js`, `card_grinding.test.js`, `sacrificial_altar` / `battery_automaton` / `chrono_trigger` interactions) for evidence; cite card ids in combo entries.

## Verification: code
