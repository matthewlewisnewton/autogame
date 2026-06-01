# Apply quantization on the wire

## Difficulty: easy
## Verification: code
## Depends on: 154-02-quantization-codec, 154-07-server-broadcast-wiring, 154-08-client-receive-integration

## Goal
Use the 154-02 codec to transmit positions/rotations as compact ints in
deltas/keyframes, dequantizing on the client — shrinking the most frequent
fields with no perceptible movement change.

## Acceptance Criteria
- Server quantizes positional/rotation fields when building delta/keyframe
  payloads; client dequantizes in `applyStateDelta` before the renderer uses
  them.
- Movement looks unchanged (within the codec tolerance); authoritative
  server-side float state is untouched.
- Delta payloads for moving entities are measurably smaller than the
  unquantized version.

## Technical Specs
- Server emit path (154-07) calls `quantizePosition/Angle`; client apply path
  (154-06/154-08) calls the inverse. No change to internal simulation state.

## Verification: code
- Tests: round-trip via the wire path stays within tolerance; movement-sync
  tests unaffected. `pnpm test:quick` green.
