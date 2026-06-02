/**
 * Pure helpers for sloped ramp floorCorners geometry.
 * Corner ordering matches game/shared/floorSampling.esm.js:
 *   NW = (−width/2, −depth/2),  NE = (+width/2, −depth/2)
 *   SE = (+width/2, +depth/2),  SW = (−width/2, +depth/2)
 */

/**
 * Build floorCorners for a ramp slab connecting two elevations along one axis.
 *
 * @param {object} params
 * @param {number} params.fromY - Y height at the low edge
 * @param {number} params.toY - Y height at the high edge
 * @param {number} params.length - Run length along the ramp axis (rise/run denominator)
 * @param {'x'|'z'} params.axis - Ramp direction: 'z' = north→south, 'x' = west→east
 * @returns {{ yNW: number, yNE: number, ySE: number, ySW: number }}
 */
export function buildRampFloorCorners({ fromY, toY, length, axis }) {
  if (fromY === toY) {
    throw new Error('buildRampFloorCorners: fromY and toY must differ (flat ramp rejected)');
  }
  if (axis !== 'x' && axis !== 'z') {
    throw new Error(`buildRampFloorCorners: invalid axis "${axis}" (expected "x" or "z")`);
  }
  if (!(length > 0)) {
    throw new Error('buildRampFloorCorners: length must be positive');
  }

  if (axis === 'z') {
    // Low edge at north (−Z): NW/NE; high edge at south (+Z): SE/SW
    return {
      yNW: fromY,
      yNE: fromY,
      ySE: toY,
      ySW: toY,
    };
  }

  // Low edge at west (−X): NW/SW; high edge at east (+X): NE/SE
  return {
    yNW: fromY,
    yNE: toY,
    ySE: toY,
    ySW: fromY,
  };
}

/**
 * Average rise/run for a ramp floorCorners quad.
 * Detects slope along X or Z from opposing edge averages.
 *
 * @param {{ yNW: number, yNE: number, ySE: number, ySW: number }} floorCorners
 * @param {number} runLength - Horizontal run along the ramp axis
 * @returns {number} rise/run (0 for flat quads)
 */
export function averageRampSlope(floorCorners, runLength) {
  if (!(runLength > 0)) {
    throw new Error('averageRampSlope: runLength must be positive');
  }

  const { yNW, yNE, ySE, ySW } = floorCorners;
  const northAvg = (yNW + yNE) / 2;
  const southAvg = (ySE + ySW) / 2;
  const westAvg = (yNW + ySW) / 2;
  const eastAvg = (yNE + ySE) / 2;

  const zRise = Math.abs(southAvg - northAvg);
  const xRise = Math.abs(eastAvg - westAvg);
  const rise = Math.max(zRise, xRise);

  return rise / runLength;
}
