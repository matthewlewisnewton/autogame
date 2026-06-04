# 223-data-derive-shop-pool-from-defs

## Difficulty: medium

## Goal

SHOP_CARD_POOL = [...VICTORY_REWARD_ROTATION,'telepipe'] and VICTORY_REWARD_ROTATION are hand-curated in game/server/config.js:37-90. Auditing vs CARD_DEFS, 8 of 42 cards are unreachable by ANY acquisition path (shop/reward/drop/evolution): mana_prism, harvesting_scythe, deck_sifter, sacrificial_altar, battery_automaton, chrono_trigger, spike_trap, mirror_ward. A new card silently defaults to unobtainable unless someone edits config.js (we hit exactly this on the recent new cards).

## Acceptance Criteria

- 1. Add a per-card acquisition tag (obtainable: shop|reward|drop-only|starter) on the card def and derive SHOP_CARD_POOL/rotation from CARD_DEFS (invert the current SHOP_CARD_POOL.filter(id=>CARD_DEFS[id]) dependency). 2. Add a test asserting every card is reachable or explicitly flagged drop-only. 3. Review the 8 currently-unreachable cards before flipping (may be intentional).

## Verification

SIMPLICITY + coverage gap. Low-medium risk (changes shop contents if omissions were unintentional).
