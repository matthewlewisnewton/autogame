# Delta-Scaled Friction

Fix frame-rate-dependent friction so terminal velocity and coast-down time are consistent across refresh rates. The current `velocity *= friction` is applied once per frame, meaning a 144Hz client applies it ~2.4× more often per second than a 60Hz client.

## Acceptance Criteria
- Friction is scaled by delta time so the effective damping rate is per-second, not per-frame
- Terminal velocity (steady-state speed while holding a key) is approximately equal at 60Hz and 144Hz
- Coast-to-stop time is approximately equal at 60Hz and 144Hz
- The `friction` constant (0.88) is preserved as the intended per-60Hz-frame factor

## Technical Specs
- **File to modify**: `game/client/main.js`
- In `updateMyPlayer(delta)`, replace:
  ```js
  velocityX *= friction;
  velocityZ *= friction;
  ```
  with a delta-scaled exponentiation that treats `friction = 0.88` as the per-60Hz-frame factor:
  ```js
  const f = Math.pow(friction, delta * 60);
  velocityX *= f;
  velocityZ *= f;
  ```
- Do not change `acceleration`, `friction` constant values, or any other movement logic
- No server changes required

## Verification: visual
