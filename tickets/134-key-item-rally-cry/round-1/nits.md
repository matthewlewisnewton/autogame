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
