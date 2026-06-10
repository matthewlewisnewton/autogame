## Unify quest-board currency label on tier-1 vs tier-2 rows

Tier-1 quest cards build reward text on the client via `formatRewardSummary` using `THEME.currency.short` (e.g. `Reward: 14 money + Glacial Orb`). Tier-2 variant rows use the server-built `rewardSummary` string, which hardcodes `stones` (e.g. `Reward: 16 stones + Gravity Well`). The signature suffix makes this mismatch more visible on the same board.

### Acceptance Criteria
- Tier-1 and tier-2 quest board rows use the same currency label source (prefer client `THEME.currency.short` for both, or align server `formatRewardSummary` with the theme).
- Signature suffix still renders correctly on both row types (e.g. frost tier 1 and spire tier 2).
