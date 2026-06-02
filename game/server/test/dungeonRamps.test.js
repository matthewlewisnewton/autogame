import { describe, it, expect } from 'vitest';
import {
  createRampRoom,
  averageRampSlope,
  validateRampSlope,
  inferRampAxis,
  MIN_RAMP_SLOPE,
} from '../dungeonRamps.js';
import { sampleFloorY } from '../dungeon.js';

describe('createRampRoom', () => {
  it('returns room shape with x, z, width, depth, walls, and floorCorners', () => {
    const room = createRampRoom({
      x: 10,
      z: 20,
      width: 8,
      depth: 16,
      axis: 'z',
      yHigh: 12,
      yLow: 4,
    });
    expect(room.x).toBe(10);
    expect(room.z).toBe(20);
    expect(room.width).toBe(8);
    expect(room.depth).toBe(16);
    expect(Array.isArray(room.walls)).toBe(true);
    expect(room.walls.length).toBeGreaterThan(0);
    expect(room.floorCorners).toEqual({
      yNW: 12,
      yNE: 12,
      ySE: 4,
      ySW: 4,
    });
    expect(room.rampAxis).toBe('z');
  });

  it('is deterministic for the same inputs', () => {
    const params = {
      x: 0,
      z: 0,
      width: 10,
      depth: 20,
      axis: 'z',
      yHigh: 10,
      yLow: 2,
      passageGap: 4,
    };
    const a = createRampRoom(params);
    const b = createRampRoom(params);
    expect(a).toEqual(b);
  });

  it('aligns corner Y to endpoints on a z-axis descending ramp', () => {
    const room = createRampRoom({
      x: 0,
      z: 0,
      width: 12,
      depth: 24,
      axis: 'z',
      yHigh: 10.5,
      yLow: 2.5,
    });
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    const layout = { rooms: [room] };

    expect(sampleFloorY(layout, room.x - halfW, room.z - halfD)).toBeCloseTo(10.5, 5);
    expect(sampleFloorY(layout, room.x + halfW, room.z - halfD)).toBeCloseTo(10.5, 5);
    expect(sampleFloorY(layout, room.x + halfW, room.z + halfD)).toBeCloseTo(2.5, 5);
    expect(sampleFloorY(layout, room.x - halfW, room.z + halfD)).toBeCloseTo(2.5, 5);
  });

  it('aligns corner Y on an x-axis ramp (west high, east low)', () => {
    const room = createRampRoom({
      x: 5,
      z: -3,
      width: 20,
      depth: 10,
      axis: 'x',
      yHigh: 8,
      yLow: 0,
    });
    expect(room.floorCorners).toEqual({
      yNW: 8,
      yNE: 0,
      ySE: 0,
      ySW: 8,
    });
    expect(inferRampAxis(room.floorCorners)).toBe('x');
  });

  it('meets minSlope when requested (descending ramp ≥ 0.15)', () => {
    const room = createRampRoom({
      x: 0,
      z: 0,
      width: 10,
      depth: 20,
      axis: 'z',
      yHigh: 10,
      yLow: 9,
      minSlope: MIN_RAMP_SLOPE,
    });
    expect(averageRampSlope(room)).toBeGreaterThanOrEqual(MIN_RAMP_SLOPE);
    expect(validateRampSlope(room)).toBe(true);
    expect(room.floorCorners.ySE).toBeCloseTo(10 - MIN_RAMP_SLOPE * 20, 5);
  });

  it('splits the high-edge wall when passageGap is set', () => {
    const room = createRampRoom({
      x: 0,
      z: 0,
      width: 12,
      depth: 16,
      axis: 'z',
      yHigh: 10,
      yLow: 2,
      passageGap: 4,
    });
    const northZ = room.z - room.depth / 2;
    const northWalls = room.walls.filter(w => w.axis === 'x' && w.z === northZ);
    expect(northWalls).toHaveLength(2);
    const southZ = room.z + room.depth / 2;
    const southWalls = room.walls.filter(w => w.axis === 'x' && w.z === southZ);
    expect(southWalls).toHaveLength(1);
  });
});

describe('averageRampSlope / validateRampSlope', () => {
  it('computes rise/run along the ramp axis for z ramps', () => {
    const room = createRampRoom({
      x: 0,
      z: 0,
      width: 8,
      depth: 20,
      axis: 'z',
      yHigh: 10,
      yLow: 4,
    });
    expect(averageRampSlope(room)).toBeCloseTo((10 - 4) / 20, 5);
  });

  it('computes rise/run along the ramp axis for x ramps', () => {
    const room = createRampRoom({
      x: 0,
      z: 0,
      width: 16,
      depth: 8,
      axis: 'x',
      yHigh: 9,
      yLow: 3,
    });
    expect(averageRampSlope(room)).toBeCloseTo((9 - 3) / 16, 5);
  });

  it('validateRampSlope rejects shallow ramps', () => {
    const shallow = createRampRoom({
      x: 0,
      z: 0,
      width: 20,
      depth: 40,
      axis: 'z',
      yHigh: 5,
      yLow: 4,
    });
    expect(averageRampSlope(shallow)).toBeCloseTo(0.025, 5);
    expect(validateRampSlope(shallow)).toBe(false);
    expect(validateRampSlope(shallow, 0.02)).toBe(true);
  });
});
