# Cleanup nits from 134-key-item-rally-cry

> **Staleness note.** This follow-up ticket was written against commit
> `9e77457` (2026-06-03). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `134-key-item-rally-cry`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Rally Cry has no client-side visual/HUD feedback
The rally_cry buff is server-authoritative and replicated via `rallyUntil` /
`rallySpeedMultiplier`, but there is no client indication that the move-speed
buff is active (no HUD timer, no aura/particle on buffed players). Players can
feel the speed change but get no confirmation the cast landed or who it
affected, which is worth adding for game feel and parity with other key-item
feedback.

### Acceptance Criteria
- While a player's `rallyUntil` is in the future, the client shows a clear
  indication the rally buff is active (e.g. HUD badge/timer or a visible aura on
  affected players).
- The indication disappears when the buff expires.
- Works for both the caster and buffed allies in radius.
