## Broadcast dotIntervalMs and attackConeAngle in the dragons_breath CARD_USED payload
The server's `dragons_breath` CARD_USED emit (game/server/cardEffects.js:927-938)
sends `dotTicks` but not `dotIntervalMs` or `attackConeAngle`. The client
renderer falls back to hardcoded `?? 500` and `?? Math.PI/3`, which happen to
match the server values today, so the animation timing/cone stay in sync only by
coincidence. If a future tuning pass or progression override changes the server's
interval or cone angle, the client animation would silently desync. Broadcasting
the values closes that gap and removes the duplicated constants.

### Acceptance Criteria
- The dragons_breath CARD_USED payload includes `dotIntervalMs` and the resolved
  `attackConeAngle` (the same values used by the server area effect).
- `renderDragonsBreath` reads those fields, keeping its `?? 500` / `?? Math.PI/3`
  only as a defensive fallback.
- Existing Wyrmflare timing tests still pass.
