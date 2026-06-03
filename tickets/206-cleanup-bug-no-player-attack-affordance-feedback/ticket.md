# Cleanup nits from 167-bug-no-player-attack-affordance-feedback

> **Staleness note.** This follow-up ticket was written against commit
> `a6f86b9` (2026-06-03). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `167-bug-no-player-attack-affordance-feedback`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Keep Canvas Clicks Weapon-Only

Canvas left-click selects the first usable weapon slot, but falls back to the first usable non-weapon card if no weapon is currently usable. The shipped behavior passes this ticket because the normal starter flow has weapon cards and the click affordance works, but the hint says "Click to attack" while "press 1-6 to cast cards"; future polish should avoid surprising spell or creature casts from canvas clicks.

### Acceptance Criteria
- Canvas left-click never casts non-weapon cards unless the UI copy is intentionally changed to describe that behavior.
- When no weapon card is usable, canvas left-click either does nothing or surfaces a small non-blocking "No weapon ready" feedback cue.
