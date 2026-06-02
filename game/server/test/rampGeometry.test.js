import { describe, it, expect } from 'vitest';
import { buildRampFloorCorners, averageRampSlope } from '../rampGeometry.js';

describe('buildRampFloorCorners', () => {
  it('builds a southward (axis z) ramp with low north edge and high south edge', () => {
    const corners = buildRampFloorCorners({ fromY: 0.5, toY: 2.0, length: 10, axis: 'z' });
    expect(corners).toEqual({
      yNW: 0.5,
      yNE: 0.5,
      ySE: 2.0,
      ySW: 2.0,
    });
  });

  it('builds an eastward (axis x) ramp with low west edge and high east edge', () => {
    const corners = buildRampFloorCorners({ fromY: 0.5, toY: 2.0, length: 10, axis: 'x' });
    expect(corners).toEqual({
      yNW: 0.5,
      yNE: 2.0,
      ySE: 2.0,
      ySW: 0.5,
    });
  });

  it('rejects flat ramps when fromY equals toY', () => {
    expect(() =>
      buildRampFloorCorners({ fromY: 1.0, toY: 1.0, length: 10, axis: 'z' }),
    ).toThrow(/flat ramp rejected/);
  });

  it('rejects invalid axis values', () => {
    expect(() =>
      buildRampFloorCorners({ fromY: 0, toY: 1, length: 10, axis: 'y' }),
    ).toThrow(/invalid axis/);
  });

  it('rejects non-positive length', () => {
    expect(() =>
      buildRampFloorCorners({ fromY: 0, toY: 1, length: 0, axis: 'z' }),
    ).toThrow(/length must be positive/);
  });
});

describe('averageRampSlope', () => {
  const RUN = 40;
  const FROM = 0.5;
  const TO = 10.5; // 10-unit rise over 40-unit run → 0.25 slope

  it('returns rise/run ≥ 0.2 for a z-axis ramp with 10-unit rise over 40-unit run', () => {
    const corners = buildRampFloorCorners({ fromY: FROM, toY: TO, length: RUN, axis: 'z' });
    const slope = averageRampSlope(corners, RUN);
    expect(slope).toBeCloseTo(0.25, 5);
    expect(slope).toBeGreaterThanOrEqual(0.2);
  });

  it('returns rise/run ≥ 0.2 for an x-axis ramp with 10-unit rise over 40-unit run', () => {
    const corners = buildRampFloorCorners({ fromY: FROM, toY: TO, length: RUN, axis: 'x' });
    const slope = averageRampSlope(corners, RUN);
    expect(slope).toBeCloseTo(0.25, 5);
    expect(slope).toBeGreaterThanOrEqual(0.2);
  });

  it('returns 0 for a flat floorCorners quad', () => {
    const flat = { yNW: 0.5, yNE: 0.5, ySE: 0.5, ySW: 0.5 };
    expect(averageRampSlope(flat, 40)).toBe(0);
  });

  it('computes slope from edge averages when only one axis varies', () => {
    const zRamp = { yNW: 0, yNE: 0, ySE: 4, ySW: 4 };
    expect(averageRampSlope(zRamp, 20)).toBeCloseTo(0.2, 5);

    const xRamp = { yNW: 0, yNE: 4, ySE: 4, ySW: 0 };
    expect(averageRampSlope(xRamp, 20)).toBeCloseTo(0.2, 5);
  });

  it('rejects non-positive runLength', () => {
    const corners = buildRampFloorCorners({ fromY: 0, toY: 1, length: 10, axis: 'z' });
    expect(() => averageRampSlope(corners, 0)).toThrow(/runLength must be positive/);
  });
});
