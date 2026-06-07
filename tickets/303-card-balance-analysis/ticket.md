# 303-card-balance-analysis

## Difficulty: medium

## Goal

BALANCE ANALYSIS of the full card roster (capstone after new cards land). Analyze every card in game/shared/cardDefs.json / cardStats.json / cardEconomy.json — incl. new/changed: ice slow-ball (294), fireball (297), AoE heal+cleanse (299), chain lightning (302), rebalanced Vault Wyrm (298) — across damage, MS cost, charges, cooldown, utility, acquisition/reward order. Identify outliers (OP/dead/mispriced) + degenerate combos. Workers cannot file beads -> WRITE a committed report game/validation/card-balance/report.md (findings.md-style) with per-card table + recommended adjustments + rationale; APPLY only clearly-safe low-risk tuning (with tests); leave larger reworks as written recs for operator triage. ACCEPTANCE: committed report covering all cards; applied tunings have passing tests. SCOPE: game/shared/card*.json + game/validation/card-balance/** + game/*/test.

## Verification

merge rejected: post-rebase verification failed
