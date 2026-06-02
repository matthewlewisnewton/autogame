const DEFAULT_MIN_SLOPE = 0.2;

const VALID_DIRECTIONS = new Set(['north', 'south', 'east', 'west']);

function assertDirection(direction) {
  if (!VALID_DIRECTIONS.has(direction)) {
    throw new Error(`buildRampPassage: invalid direction "${direction}"`);
  }
}

/**
 * Corner heights on the edge of `room` where the ramp leaves (exit side).
 * yW/yE span the edge perpendicular to the ramp axis; yN/yS for east/west ramps.
 */
function getExitEdge(room, direction) {
  const fc = room.floorCorners;
  switch (direction) {
    case 'north':
      return { yW: fc.yNW, yE: fc.yNE };
    case 'south':
      return { yW: fc.ySW, yE: fc.ySE };
    case 'east':
      return { yN: fc.yNE, yS: fc.ySE };
    case 'west':
      return { yN: fc.yNW, yS: fc.ySW };
    default:
      assertDirection(direction);
  }
}

/** Corner heights on the edge of `room` where the ramp enters (entry side). */
function getEntryEdge(room, direction) {
  const fc = room.floorCorners;
  switch (direction) {
    case 'north':
      return { yW: fc.ySW, yE: fc.ySE };
    case 'south':
      return { yW: fc.yNW, yE: fc.yNE };
    case 'east':
      return { yN: fc.yNW, yS: fc.ySW };
    case 'west':
      return { yN: fc.yNE, yS: fc.ySE };
    default:
      assertDirection(direction);
  }
}

function edgeMean(edge, direction) {
  if (direction === 'east' || direction === 'west') {
    return (edge.yN + edge.yS) / 2;
  }
  return (edge.yW + edge.yE) / 2;
}

function floorCornersForRamp(direction, exit, entry) {
  switch (direction) {
    case 'south':
      return { yNW: exit.yW, yNE: exit.yE, ySE: entry.yE, ySW: entry.yW };
    case 'north':
      return { yNW: entry.yW, yNE: entry.yE, ySE: exit.yE, ySW: exit.yW };
    case 'east':
      return { yNW: exit.yN, yNE: entry.yN, ySE: entry.yS, ySW: exit.yS };
    case 'west':
      return { yNW: entry.yN, yNE: exit.yN, ySE: exit.yS, ySW: entry.yS };
    default:
      assertDirection(direction);
  }
}

/** Horizontal run between room edges along the ramp axis (must be > 0). */
function naturalCorridorRun(fromRoom, toRoom, direction) {
  switch (direction) {
    case 'north':
      return fromRoom.z - fromRoom.depth / 2 - (toRoom.z + toRoom.depth / 2);
    case 'south':
      return toRoom.z - toRoom.depth / 2 - (fromRoom.z + fromRoom.depth / 2);
    case 'east':
      return toRoom.x - toRoom.width / 2 - (fromRoom.x + fromRoom.width / 2);
    case 'west':
      return fromRoom.x - fromRoom.width / 2 - (toRoom.x + toRoom.width / 2);
    default:
      assertDirection(direction);
  }
}

function buildRampWalls(fromRoom, toRoom, direction, passageWidth, corridorLength) {
  const halfGap = passageWidth / 2;
  const walls = [];

  switch (direction) {
    case 'south': {
      const zFrom = fromRoom.z + fromRoom.depth / 2;
      const zTo = toRoom.z - toRoom.depth / 2;
      const wallCentreZ = (zFrom + zTo) / 2;
      walls.push({ x: fromRoom.x - halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' });
      walls.push({ x: fromRoom.x + halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' });
      break;
    }
    case 'north': {
      const zFrom = fromRoom.z - fromRoom.depth / 2;
      const zTo = toRoom.z + toRoom.depth / 2;
      const wallCentreZ = (zFrom + zTo) / 2;
      walls.push({ x: fromRoom.x - halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' });
      walls.push({ x: fromRoom.x + halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' });
      break;
    }
    case 'east': {
      const xFrom = fromRoom.x + fromRoom.width / 2;
      const xTo = toRoom.x - toRoom.width / 2;
      const wallCentreX = (xFrom + xTo) / 2;
      walls.push({ x: wallCentreX, z: fromRoom.z - halfGap, length: corridorLength, axis: 'x' });
      walls.push({ x: wallCentreX, z: fromRoom.z + halfGap, length: corridorLength, axis: 'x' });
      break;
    }
    case 'west': {
      const xFrom = fromRoom.x - fromRoom.width / 2;
      const xTo = toRoom.x + toRoom.width / 2;
      const wallCentreX = (xFrom + xTo) / 2;
      walls.push({ x: wallCentreX, z: fromRoom.z - halfGap, length: corridorLength, axis: 'x' });
      walls.push({ x: wallCentreX, z: fromRoom.z + halfGap, length: corridorLength, axis: 'x' });
      break;
    }
    default:
      assertDirection(direction);
  }

  return walls;
}

/**
 * Build a sloped ramp passage between two tier-sized rooms.
 *
 * @param {object} fromRoom - lower tier room ({ x, z, width, depth, floorCorners })
 * @param {object} toRoom - upper tier room
 * @param {object} [options]
 * @param {number} [options.passageWidth=4]
 * @param {'north'|'south'|'east'|'west'} options.direction - exit edge of fromRoom
 * @param {number} [options.rise] - vertical rise budget for slope enforcement (defaults to edge delta)
 * @param {number} [options.minSlope=0.2] - minimum average rise/run
 */
function buildRampPassage(fromRoom, toRoom, options = {}) {
  const direction = options.direction;
  assertDirection(direction);

  const passageWidth = options.passageWidth ?? 4;
  const minSlope = options.minSlope ?? DEFAULT_MIN_SLOPE;

  const naturalRun = naturalCorridorRun(fromRoom, toRoom, direction);
  if (!(naturalRun > 0)) {
    throw new Error(
      `buildRampPassage: rooms do not align for direction "${direction}" (run=${naturalRun})`
    );
  }

  const exit = getExitEdge(fromRoom, direction);
  const entry = getEntryEdge(toRoom, direction);
  const naturalRise = edgeMean(entry, direction) - edgeMean(exit, direction);

  const slopeRise = options.rise !== undefined ? options.rise : naturalRise;
  if (slopeRise < 0) {
    throw new Error(`buildRampPassage: negative rise (${slopeRise}) is not supported`);
  }

  const minRunForSlope = slopeRise > 0 ? slopeRise / minSlope : 0;
  let corridorLength = naturalRun;
  if (slopeRise > 0 && corridorLength < minRunForSlope) {
    corridorLength = minRunForSlope;
  }
  if (slopeRise > 0 && corridorLength > minRunForSlope) {
    throw new Error(
      `buildRampPassage: corridor run ${corridorLength.toFixed(3)} is too long for rise ${slopeRise} at minSlope ${minSlope}`
    );
  }

  const floorCorners = floorCornersForRamp(direction, exit, entry);
  const walls = buildRampWalls(fromRoom, toRoom, direction, passageWidth, corridorLength);

  return {
    x1: fromRoom.x,
    z1: fromRoom.z,
    x2: toRoom.x,
    z2: toRoom.z,
    corridorLength,
    walls,
    floorCorners,
    direction,
    rise: naturalRise,
    avgSlope: corridorLength > 0 ? slopeRise / corridorLength : 0,
  };
}

module.exports = {
  buildRampPassage,
  DEFAULT_MIN_SLOPE,
};
