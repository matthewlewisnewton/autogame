# Align flat-room regression test with ticket spec coordinates

The flat-room test case in `shared-floor-sampling.test.js` samples at `(5, 5)` inside a room centered at `(0, 0)`. The room center is `(0, 0)`, which is the more natural and spec-aligned coordinate to test. Change the sample point to `(0, 0)` and update the inline comment.

## Acceptance Criteria

- The "returns DEFAULT_FLOOR_Y at the centre of a flat room" test case calls `sampleFloorY(layout, 0, 0)` instead of `sampleFloorY(layout, 5, 5)`.
- The inline comment is updated to explain that `(0, 0)` is the room center.
- The test still expects `DEFAULT_FLOOR_Y` (0.5) and passes.

## Technical Specs

- **`game/client/test/shared-floor-sampling.test.js`** — change the `sampleFloorY(layout, 5, 5)` call to `sampleFloorY(layout, 0, 0)` in the flat-room test case and update the accompanying comment.

## Verification: code
