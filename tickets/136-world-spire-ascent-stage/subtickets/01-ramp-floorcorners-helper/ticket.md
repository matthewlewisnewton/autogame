# 01 — Ramp floorCorners geometry helper

Add a small, deterministic server helper that computes sloped `floorCorners` for a ramp slab connecting two elevations, plus utilities to validate average slope (rise/run).

## Acceptance Criteria

- New module exports `buildRampFloorCorners({ fromY, toY, length, axis })` returning `{ yNW, yNE, ySE, ySW }` where the low edge matches `fromY` and the high edge matches `toY`.
- `averageRampSlope(floorCorners, runLength)` returns rise/run; for a valid ramp built by the helper, slope is ≥ 0.2 when `|toY - fromY| / runLength ≥ 0.2`.
- Corner ordering matches `game/shared/floorSampling.esm.js` (NW/NE/SE/SW relative to ramp center, same as rooms).
- Helper is pure (no RNG, no layout mutation) and safe to import from `dungeon.js` and future canyon (137) work.
- Unit tests in `game/server/test/rampGeometry.test.js` cover both `axis: 'z'` and `axis: 'x'` ramps, flat rejection when `fromY === toY`, and slope threshold math.

## Technical Specs

- **`game/server/rampGeometry.js`** (new): implement `buildRampFloorCorners`, `averageRampSlope`, and export both.
- **`game/server/test/rampGeometry.test.js`** (new): vitest coverage for corner values, slope ≥ 0.2 on a 10-unit rise over 40-unit run (0.25), and axis flips.
- No changes to `generateLayout` in this sub-ticket — geometry only.

## Verification: code
