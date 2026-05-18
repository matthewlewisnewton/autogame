# Delta-Scaled Friction Formula

Replace the per-frame friction multiplier (`velocityX *= friction`) with a delta-scaled version so damping is a per-second rate, not a per-frame rate. This is the core fix for frame-rate-dependent terminal velocity.

## Acceptance Criteria
- `velocityX *= friction` and `velocityZ *= friction` are replaced by a delta-scaled computation
- The formula uses `Math.pow(friction, delta * 60)` to treat `0.88` as the intended per-60Hz-frame factor
- No other movement logic (acceleration, position integration, socket emit) is changed
- The `friction` constant remains `0.88`

## Technical Specs
- **File to modify**: `game/client/main.js`
- In `updateMyPlayer(delta)`, replace the two lines:
  ```js
  velocityX *= friction;
  velocityZ *= friction;
  ```
  with:
  ```js
  const f = Math.pow(friction, delta * 60);
  velocityX *= f;
  velocityZ *= f;
  ```
- Do not change `acceleration`, `friction`, or any other constant
- No server changes

## Verification: code
