# Cleanup nits from per-quest-signature-card-rewards-replace-the-single-global-v-o0vv.5

> **Staleness note.** This follow-up ticket was written against commit
> `3685eb1c` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `per-quest-signature-card-rewards-replace-the-single-global-v-o0vv.5`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Unify quest-board currency label on tier-1 vs tier-2 rows

Tier-1 quest cards build reward text on the client via `formatRewardSummary` using `THEME.currency.short` (e.g. `Reward: 14 money + Glacial Orb`). Tier-2 variant rows use the server-built `rewardSummary` string, which hardcodes `stones` (e.g. `Reward: 16 stones + Gravity Well`). The signature suffix makes this mismatch more visible on the same board.

### Acceptance Criteria
- Tier-1 and tier-2 quest board rows use the same currency label source (prefer client `THEME.currency.short` for both, or align server `formatRewardSummary` with the theme).
- Signature suffix still renders correctly on both row types (e.g. frost tier 1 and spire tier 2).
