// Reusable sloped ramp rooms (floorCorners + perimeter walls) for stage generators.

const MIN_RAMP_SLOPE = 0.15;

/**
 * Infer ramp travel axis from floor corner heights ('z' = north/south, 'x' = west/east).
 * @param {{ yNW: number, yNE: number, ySE: number, ySW: number }} floorCorners
 * @returns {'x'|'z'}
 */
function inferRampAxis(floorCorners) {
  const northAvg = (floorCorners.yNW + floorCorners.yNE) / 2;
  const southAvg = (floorCorners.ySE + floorCorners.ySW) / 2;
  const westAvg = (floorCorners.yNW + floorCorners.ySW) / 2;
  const eastAvg = (floorCorners.yNE + floorCorners.ySE) / 2;
  return Math.abs(northAvg - southAvg) >= Math.abs(westAvg - eastAvg) ? 'z' : 'x';
}

/**
 * Average rise/run along the ramp axis for a sloped room.
 * @param {{ floorCorners: object, width: number, depth: number, rampAxis?: string }} room
 * @returns {number}
 */
function averageRampSlope(room) {
  const fc = room.floorCorners;
  const axis = room.rampAxis || inferRampAxis(fc);
  if (axis === 'z') {
    const high = Math.max(fc.yNW, fc.yNE);
    const low = Math.min(fc.ySE, fc.ySW);
    return (high - low) / room.depth;
  }
  const high = Math.max(fc.yNW, fc.ySW);
  const low = Math.min(fc.yNE, fc.ySE);
  return (high - low) / room.width;
}

/**
 * @param {{ floorCorners: object, width: number, depth: number, rampAxis?: string }} room
 * @param {number} [minSlope=MIN_RAMP_SLOPE]
 * @returns {boolean}
 */
function validateRampSlope(room, minSlope = MIN_RAMP_SLOPE) {
  return averageRampSlope(room) >= minSlope - 1e-9;
}

/**
 * Build perimeter walls with an optional centered passage gap on one edge.
 * @param {number} x
 * @param {number} z
 * @param {number} width
 * @param {number} depth
 * @param {'north'|'south'|'east'|'west'|null} gapSide
 * @param {number} gap
 * @returns {object[]}
 */
function buildRampWalls(x, z, width, depth, gapSide, gap) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const walls = [];

  function addWall(wx, wz, length, axis, side) {
    if (gapSide === side && gap > 0 && gap < length) {
      const segLen = (length - gap) / 2;
      if (axis === 'x') {
        walls.push({ x: wx - gap / 2 - segLen / 2, z: wz, length: segLen, axis: 'x' });
        walls.push({ x: wx + gap / 2 + segLen / 2, z: wz, length: segLen, axis: 'x' });
      } else {
        walls.push({ x: wx, z: wz - gap / 2 - segLen / 2, length: segLen, axis: 'z' });
        walls.push({ x: wx, z: wz + gap / 2 + segLen / 2, length: segLen, axis: 'z' });
      }
      return;
    }
    walls.push({ x: wx, z: wz, length, axis });
  }

  addWall(x, z - halfD, width, 'x', 'north');
  addWall(x, z + halfD, width, 'x', 'south');
  addWall(x - halfW, z, depth, 'z', 'west');
  addWall(x + halfW, z, depth, 'z', 'east');

  return walls;
}

/**
 * Create a sloped ramp room between two floor bands.
 *
 * Corner layout (axis 'z'): north edge = yHigh, south edge = yLow.
 * Corner layout (axis 'x'): west edge = yHigh, east edge = yLow.
 *
 * @param {object} opts
 * @param {number} opts.x - room center X
 * @param {number} opts.z - room center Z
 * @param {number} opts.width
 * @param {number} opts.depth
 * @param {'x'|'z'} opts.axis - direction of travel along the ramp
 * @param {number} opts.yHigh - Y on the high band edge
 * @param {number} opts.yLow - Y on the low band edge
 * @param {number} [opts.passageGap] - if set, centered gap on the high edge (plateau entry)
 * @param {number} [opts.minSlope] - when set, lowers yLow so rise/run is at least minSlope
 * @returns {{ x: number, z: number, width: number, depth: number, walls: object[], floorCorners: object, rampAxis: string }}
 */
function createRampRoom({ x, z, width, depth, axis, yHigh, yLow, passageGap, minSlope }) {
  const rampAxis = axis === 'x' ? 'x' : 'z';
  const run = rampAxis === 'z' ? depth : width;
  let lowY = yLow;

  if (minSlope != null && minSlope > 0) {
    const minRise = minSlope * run;
    const rise = yHigh - lowY;
    if (rise < minRise) {
      lowY = yHigh - minRise;
    }
  }

  let floorCorners;
  if (rampAxis === 'z') {
    floorCorners = {
      yNW: yHigh,
      yNE: yHigh,
      ySE: lowY,
      ySW: lowY,
    };
  } else {
    floorCorners = {
      yNW: yHigh,
      yNE: lowY,
      ySE: lowY,
      ySW: yHigh,
    };
  }

  const gapSide =
    passageGap != null && passageGap > 0
      ? (rampAxis === 'z' ? 'north' : 'west')
      : null;
  const walls = buildRampWalls(x, z, width, depth, gapSide, passageGap || 0);

  return {
    x,
    z,
    width,
    depth,
    walls,
    floorCorners,
    rampAxis,
  };
}

module.exports = {
  MIN_RAMP_SLOPE,
  inferRampAxis,
  averageRampSlope,
  validateRampSlope,
  createRampRoom,
};
