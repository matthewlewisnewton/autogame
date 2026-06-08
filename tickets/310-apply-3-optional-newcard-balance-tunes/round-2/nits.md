## Fix Ice Ball Spotlight Slow-Factor Wording

The card-balance report's ice_ball spotlight says "65% slow, 3 s, 0.65 factor", but the implemented balance tune only raised `slowChance` to `0.65`; `slowFactor` remains `0.5` in `game/shared/cardStats.json`. The report should distinguish proc chance from slow factor so future balance passes do not assume the movement slow strength changed.

### Acceptance Criteria

- `game/validation/card-balance/report.md` describes ice_ball utility as 65% slow chance with a 3 s duration and 0.5 slow factor.
- No card stats or gameplay code change as part of this documentation cleanup.
