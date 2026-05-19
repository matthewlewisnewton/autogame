# Extract and test delta-time helper

The `animate()` function in `main.js` calls `clock.getDelta()` inline with no clamping or helper abstraction. Extract a pure `clampDelta()` (or similar) function that converts raw delta-time to seconds and clamps to a sensible max (e.g., 0.1s to prevent spiral-of-death on tab-switch), then add unit tests.

## Acceptance Criteria

- A pure function `clampDelta(rawDelta)` (or similar name) is extracted into `game/client/delta.js` (or alongside an existing client utility module).
- The function clamps the raw delta to a maximum (e.g., 100ms / 0.1s) and returns the value in seconds.
- `animate()` in `main.js` uses this helper instead of calling `clock.getDelta()` directly.
- A unit test file covers the helper with cases: normal delta passthrough, max delta clamp, zero delta, and negative delta.
- `npm test` passes all tests.

## Technical Specs

- **File to create:** `game/client/delta.js` — export `clampDelta(rawDelta)` that returns `Math.min(rawDelta, 0.1)` (or similar cap).
- **File to change:** `game/client/main.js` — import and use `clampDelta(clock.getDelta())` in `animate()`.
- **File to create:** `game/client/test/delta.test.js` — unit tests for `clampDelta()` (normal values, clamped max, edge cases).

## Verification: code
