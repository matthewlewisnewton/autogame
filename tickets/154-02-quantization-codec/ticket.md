# Positional quantization codec (pure util)

## Difficulty: easy
## Verification: code
## Depends on: none

## Goal
A pure, shared util that quantizes positions/rotations to compact fixed-point
ints and back, with bounded error. NO wiring into the game yet — just the codec
+ tests (so it can be built fully in parallel with everything else).

## Acceptance Criteria
- `quantizePosition({x,y,z})`/`dequantizePosition(...)` and
  `quantizeAngle`/`dequantizeAngle` (radians) using fixed-point scaling over a
  bounded range.
- Round-trip error within tolerance: position < ~2mm, angle < ~0.5°.
- Quantized output is integer-valued (small ints), encode/decode are inverse.

## Technical Specs
- New `game/shared/quantize.js` (importable by both server and client) + unit
  tests. No changes to server/client runtime paths in this ticket.

## Verification: code
- Unit tests assert round-trip tolerance + integer output across the coordinate
  range. `pnpm test:quick` green.
