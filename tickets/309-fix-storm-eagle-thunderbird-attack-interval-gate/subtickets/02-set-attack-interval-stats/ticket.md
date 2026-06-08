# 02-set-attack-interval-stats

Add `attackIntervalMs` values to the `storm_eagle` and `thunderbird` entries in `cardStats.json` so their real DPS falls into the intended peer band (Q1–Q3 = 4–13 DPS). The 303 balance report flags storm_eagle as `over` due to per-tick firing; thunderbird is `ok` on paper but also lacks an interval gate.

## Acceptance Criteria

- `storm_eagle` entry in `cardStats.json` has an `"attackIntervalMs"` field set to `1500`
- `thunderbird` entry in `cardStats.json` has an `"attackIntervalMs"` field set to `1500`
- No other stats on these cards are changed (attackDamage, attackRange, minionHp, etc. remain identical)
- The resulting DPS for storm_eagle is 13 / 1.5 = ~8.7 DPS (within the 4–13 peer band)
- The resulting DPS for thunderbird primary hit is 20 / 1.5 = ~13.3 DPS (at top of band; chain adds multi-target pressure which the 303 report already accepted)

## Technical Specs

- **File:** `game/shared/cardStats.json`
- Add `"attackIntervalMs": 1500` to the `storm_eagle` object (after `attackDamage`)
- Add `"attackIntervalMs": 1500` to the `thunderbird` object (after `attackDamage`)
- Rationale for 1500ms: brings storm_eagle DPS (~8.7) squarely into the 4–13 peer band; null_crawler uses 2000ms but has higher per-hit damage (22), so 1500ms is proportionally consistent

## Verification: code
