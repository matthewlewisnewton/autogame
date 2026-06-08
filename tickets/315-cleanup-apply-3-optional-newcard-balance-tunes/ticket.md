# Cleanup nits from 310-apply-3-optional-newcard-balance-tunes

> **Staleness note.** This follow-up ticket was written against commit
> `b612f421` (2026-06-07). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `310-apply-3-optional-newcard-balance-tunes`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Fix Ice Ball Spotlight Slow-Factor Wording

The card-balance report's ice_ball spotlight says "65% slow, 3 s, 0.65 factor", but the implemented balance tune only raised `slowChance` to `0.65`; `slowFactor` remains `0.5` in `game/shared/cardStats.json`. The report should distinguish proc chance from slow factor so future balance passes do not assume the movement slow strength changed.

### Acceptance Criteria

- `game/validation/card-balance/report.md` describes ice_ball utility as 65% slow chance with a 3 s duration and 0.5 slow factor.
- No card stats or gameplay code change as part of this documentation cleanup.
