# 311-slower-scaling-early-strong-cards-plus-astral-trim

## Difficulty: medium

## Goal

Rebalance over-strong early/mid cards by SLOWING their grind-scaling (keep them strong WHEN acquired, taper their late scaling). Use the existing grind-scaling system (scaledGrindStat in game/server/progression.js).
- Signal Familiar (battle_familiar, reward:1, burst 44): reduce how much its damage/minion stats grow per grind level so it stays a strong early pick but does not dominate late. Keep base power.
- Phase Stalker (null_crawler, reward:12 minion): same — slower per-grind scaling.
- Astral Guardian (astral_guardian, EVOLVED/late): slower scaling does NOT fit (its issue is high LATE power). Instead apply a SMALL conservative direct trim to its burst or shield so it is still top-tier but less of an outlier.
Be VERY conservative — small reductions only; do not gut these cards. ACCEPTANCE: battle_familiar + null_crawler keep early power but scale more slowly per grind; astral_guardian slightly trimmed; tests + the 303 report updated. SCOPE: game/server/progression.js (per-card grind scaling), game/shared/cardStats.json, test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
