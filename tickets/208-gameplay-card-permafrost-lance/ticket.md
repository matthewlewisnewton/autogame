# 208-gameplay-card-permafrost-lance

## Difficulty: medium

## Goal

New T2 spell 'Permafrost Lance' — a cheap forward freeze-poke filling the gap between frost_nova and glacier_collapse. Reuses the existing frost_nova freeze branch, so near-zero new engine code.

## Acceptance Criteria

- 1. Add permafrost_lance to CARD_DEFS (game/server/progression.js) reusing effect:'frost_nova' with magicStoneCost 30, damage 8, radius 6, freezeDurationMs 2000.
- 2. Add identity stub to game/shared/cardDefs.json (id, name, type:spell, charges:1).
- 3. Add the id to SHOP_CARD_POOL (game/server/progression.js) so it is OBTAINABLE in-game — a card not in the pool never appears.
- 4. On cast it freezes + lightly damages enemies in range; existing card UI renders it in shop/hand.
- 5. Add/extend a test for the new def + freeze behavior; full vitest green.

## Verification

Effect routing handled by the frost_nova/glacier_collapse branch at game/server/cardEffects.js:458 (applyFreezeInRadius). No new engine feature — a tighter, cheaper sidegrade to frost_nova.

merge rejected: post-rebase verification failed
