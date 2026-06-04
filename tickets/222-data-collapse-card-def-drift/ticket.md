# 222-data-collapse-card-def-drift

## Difficulty: medium

## Goal

Card data is split 3 ways: cardDefs.json (identity), progression.js CARD_DEFS (server stats, L115-478), and client cards.js CARD_DEFS (a PARTIAL hand-retyped copy of stats, L13-245). CARD_SELL_VALUES + EVOLUTION_TRANSFORMS are duplicated in both progression.js and cards.js and HAVE ALREADY DRIFTED: server has aegis_sentinel:22 sell, client lacks it; client has arcane_bolt:8, server lacks it. card_sync.test.js only guards id/name/type/charges so the stat/sell drift shipped silently.

## Acceptance Criteria

- 1. Move full per-card stat objects into one shared module (extend cardDefs.json or a shared cardDefs.js); both server and client CARD_DEFS spread from it (server-only fields become a thin server overlay). 2. Make CARD_SELL_VALUES + EVOLUTION_TRANSFORMS shared single sources. 3. Keep getCardSellValue computed fallback (progression.js:704-709). 4. Expand card_sync.test.js to diff full stat objects. Land shared module first, switch one consumer at a time.

## Verification

CORRECTNESS (live drift) + SIMPLICITY. Medium risk: touches client+server card construction; incremental.
