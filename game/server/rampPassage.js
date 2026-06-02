const DEFAULT_PASSAGE_WIDTH = 4;

/**
 * Build a sloped ramp passage between two tier rooms (flat platforms at different elevations).
 * Connects room edges along the dominant axis between room centers (spire tiers typically +Z).
 *
 * @param {object} fromRoom - Lower tier room ({ x, z, width, depth })
 * @param {object} toRoom - Upper tier room
 * @param {object} options
 * @param {number} [options.passageWidth=DEFAULT_PASSAGE_WIDTH]
 * @param {number} options.lowY - Floor Y at the fromRoom (low) end
 * @param {number} options.highY - Floor Y at the toRoom (high) end
 * @returns {object} Passage compatible with layout consumers
 */
function buildRampPassage(fromRoom, toRoom, options = {}) {
  const passageWidth = options.passageWidth ?? DEFAULT_PASSAGE_WIDTH;
  const lowY = options.lowY;
  const highY = options.highY;
  const halfGap = passageWidth / 2;

  const dx = toRoom.x - fromRoom.x;
  const dz = toRoom.z - fromRoom.z;

  let axis;
  let corridorLength;
  let walls;
  let floorCorners;

  let floorX;
  let floorZ;
  let floorWidth;
  let floorDepth;

  if (Math.abs(dz) >= Math.abs(dx)) {
    axis = 'z';
    corridorLength = Math.abs(dz) - fromRoom.depth / 2 - toRoom.depth / 2;
    const wallCentreZ = (fromRoom.z + toRoom.z) / 2;
    walls = [
      { x: fromRoom.x - halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' },
      { x: fromRoom.x + halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' },
    ];
    // NW/NE = low-Z edge; SE/SW = high-Z edge (see floorSampling corner ordering).
    floorCorners = dz >= 0
      ? { yNW: lowY, yNE: lowY, ySE: highY, ySW: highY }
      : { yNW: highY, yNE: highY, ySE: lowY, ySW: lowY };
    const sign = Math.sign(dz) || 1;
    const zStart = fromRoom.z + sign * (fromRoom.depth / 2);
    const zEnd = toRoom.z - sign * (toRoom.depth / 2);
    floorWidth = passageWidth;
    floorDepth = corridorLength;
    floorX = fromRoom.x;
    floorZ = (zStart + zEnd) / 2;
  } else {
    axis = 'x';
    corridorLength = Math.abs(dx) - fromRoom.width / 2 - toRoom.width / 2;
    const wallCentreX = (fromRoom.x + toRoom.x) / 2;
    walls = [
      { x: wallCentreX, z: fromRoom.z - halfGap, length: corridorLength, axis: 'x' },
      { x: wallCentreX, z: fromRoom.z + halfGap, length: corridorLength, axis: 'x' },
    ];
    // NW/SW = low-X edge; NE/SE = high-X edge.
    floorCorners = dx >= 0
      ? { yNW: lowY, yNE: highY, ySE: highY, ySW: lowY }
      : { yNW: highY, yNE: lowY, ySE: lowY, ySW: highY };
    const sign = Math.sign(dx) || 1;
    const xStart = fromRoom.x + sign * (fromRoom.width / 2);
    const xEnd = toRoom.x - sign * (toRoom.width / 2);
    floorWidth = corridorLength;
    floorDepth = passageWidth;
    floorX = (xStart + xEnd) / 2;
    floorZ = fromRoom.z;
  }

  return {
    x1: fromRoom.x,
    z1: fromRoom.z,
    x2: toRoom.x,
    z2: toRoom.z,
    walls,
    corridorLength,
    floorCorners,
    floorX,
    floorZ,
    floorWidth,
    floorDepth,
    isRamp: true,
    axis,
    lowY,
    highY,
  };
}

/**
 * Average rise/run for a ramp passage from its floorCorners and corridor length.
 * Uses ((ySE + ySW) / 2 − (yNW + yNE) / 2) / corridorLength.
 *
 * @param {object} passage - Passage from buildRampPassage
 * @returns {number} Non-negative slope (0 if flat or zero run)
 */
function averageRampSlope(passage) {
  const { floorCorners, corridorLength } = passage;
  if (!floorCorners || !corridorLength || corridorLength <= 0) {
    return 0;
  }
  const rise = (floorCorners.ySE + floorCorners.ySW) / 2 - (floorCorners.yNW + floorCorners.yNE) / 2;
  return Math.abs(rise) / corridorLength;
}

module.exports = {
  buildRampPassage,
  averageRampSlope,
};
