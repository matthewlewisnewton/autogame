## Keep Canvas Clicks Weapon-Only

Canvas left-click selects the first usable weapon slot, but falls back to the first usable non-weapon card if no weapon is currently usable. The shipped behavior passes this ticket because the normal starter flow has weapon cards and the click affordance works, but the hint says "Click to attack" while "press 1-6 to cast cards"; future polish should avoid surprising spell or creature casts from canvas clicks.

### Acceptance Criteria
- Canvas left-click never casts non-weapon cards unless the UI copy is intentionally changed to describe that behavior.
- When no weapon card is usable, canvas left-click either does nothing or surfaces a small non-blocking "No weapon ready" feedback cue.
