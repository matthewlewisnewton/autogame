// ── Floor Height Sampling (imported from shared module) ──

const { sampleFloorY, DEFAULT_FLOOR_Y } = require('../shared/floorSampling.js');
const {
  createRampRoom,
  averageRampSlope,
  validateRampSlope,
  inferRampAxis,
  MIN_RAMP_SLOPE,
} = require('./dungeonRamps.js');

// ── Seeded PRNG (Mulberry32) ──

function mulberry32(seed) {
  let s = seed | 0; // coerce to signed 32-bit int
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Dungeon Layout Generator ──

// Grid dimensions and spacing for room placement (default profile)
const GRID_COLS = 4;
const GRID_ROWS = 4;
const CELL_SPACING = 20; // center-to-center distance between adjacent cells
const MIN_ROOM_SIZE = 12;
const MAX_ROOM_SIZE_INCLUSIVE = 15;
const PASSAGE_WIDTH = 4;

const DEFAULT_LAYOUT_PROFILE = {
  gridCols: GRID_COLS,
  gridRows: GRID_ROWS,
  cellSpacing: CELL_SPACING,
  minRoomSize: MIN_ROOM_SIZE,
  maxRoomSize: MAX_ROOM_SIZE_INCLUSIVE,
  passageWidth: PASSAGE_WIDTH,
  targetRoomFraction: 0.6,
  minRooms: 4,
  maxRooms: GRID_ROWS * GRID_COLS,
  extraEdgeFraction: 0.3,
};

const LAYOUT_PROFILES = {
  crowded: {
    ...DEFAULT_LAYOUT_PROFILE,
    targetRoomFraction: 0.65,
    cellSpacing: 18,
    minRoomSize: 12,
    maxRoomSize: 14,
    extraEdgeFraction: 0.35,
  },
  open: {
    ...DEFAULT_LAYOUT_PROFILE,
    targetRoomFraction: 0.35,
    cellSpacing: 28,
    minRoomSize: 18,
    maxRoomSize: 24,
    passageWidth: 6,
    minRooms: 4,
    maxRooms: 7,
    extraEdgeFraction: 0.08,
  },
};

function normalizeLayoutProfile(profile) {
  if (typeof profile === 'string') {
    return { ...DEFAULT_LAYOUT_PROFILE, ...(LAYOUT_PROFILES[profile] || LAYOUT_PROFILES.crowded) };
  }
  return { ...DEFAULT_LAYOUT_PROFILE, ...(profile || {}) };
}

function questLayoutSeed(questId) {
  let hash = 0;
  for (let i = 0; i < questId.length; i++) {
    hash = (hash * 31 + questId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

const SUNKEN_PLATEAU_Y = 10;
const SUNKEN_CANYON_Y = 2;
const SUNKEN_MIN_CANYON_AREA = 4 * MIN_ROOM_SIZE * MIN_ROOM_SIZE;

/**
 * Build axis-aligned wall segments along one rectangular edge, with optional gaps.
 * @param {'north'|'south'|'east'|'west'} edge
 * @param {number[]} gapCenters - offsets from room center along the edge tangent
 */
function buildEdgeWallSegments(cx, cz, width, depth, edge, gapCenters, gapWidth) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const gapHalf = gapWidth / 2;
  const sorted = [...gapCenters].sort((a, b) => a - b);
  const walls = [];

  function pushSegments(edgeLength, axis, fixedX, fixedZ) {
    const halfLen = edgeLength / 2;
    const gaps = sorted.map(g => ({ start: g - gapHalf, end: g + gapHalf }));
    let cursor = -halfLen;
    for (const gap of gaps) {
      const segLen = gap.start - cursor;
      if (segLen > 0.05) {
        const segCenter = cursor + segLen / 2;
        if (axis === 'x') {
          walls.push({ x: cx + segCenter, z: fixedZ, length: segLen, axis: 'x' });
        } else {
          walls.push({ x: fixedX, z: cz + segCenter, length: segLen, axis: 'z' });
        }
      }
      cursor = gap.end;
    }
    const tail = halfLen - cursor;
    if (tail > 0.05) {
      const segCenter = cursor + tail / 2;
      if (axis === 'x') {
        walls.push({ x: cx + segCenter, z: fixedZ, length: tail, axis: 'x' });
      } else {
        walls.push({ x: fixedX, z: cz + segCenter, length: tail, axis: 'z' });
      }
    }
  }

  if (edge === 'north') {
    pushSegments(width, 'x', cx, cz - halfD);
  } else if (edge === 'south') {
    pushSegments(width, 'x', cx, cz + halfD);
  } else if (edge === 'west') {
    pushSegments(depth, 'z', cx - halfW, cz);
  } else {
    pushSegments(depth, 'z', cx + halfW, cz);
  }

  return walls;
}

function createFlatBandRoom({ x, z, width, depth, y, edgeGaps = {}, gapWidth = PASSAGE_WIDTH }) {
  const walls = [];
  for (const edge of ['north', 'south', 'east', 'west']) {
    const gaps = edgeGaps[edge] || [];
    walls.push(
      ...buildEdgeWallSegments(x, z, width, depth, edge, gaps, gapWidth)
    );
  }
  return {
    x,
    z,
    width,
    depth,
    walls,
    floorCorners: {
      yNW: y,
      yNE: y,
      ySE: y,
      ySW: y,
    },
  };
}

/** Open the low (south) edge of a z-axis ramp so it connects to the canyon. */
function openRampSouthPassage(room, gapWidth) {
  const halfD = room.depth / 2;
  const southZ = room.z + halfD;
  room.walls = room.walls.filter(
    w => !(w.axis === 'x' && Math.abs(w.z - southZ) < 1e-6)
  );
  const segLen = (room.width - gapWidth) / 2;
  room.walls.push(
    { x: room.x - gapWidth / 2 - segLen / 2, z: southZ, length: segLen, axis: 'x' },
    { x: room.x + gapWidth / 2 + segLen / 2, z: southZ, length: segLen, axis: 'x' }
  );
}

/**
 * Deterministic Sunken Canyon stage: upper plateau, lower canyon, 2–3 ramps.
 * @param {number} seed
 * @param {object} [options]
 */
function generateSunkenCanyonLayout(seed, options = {}) {
  const rng = mulberry32(seed);
  const passageWidth = PASSAGE_WIDTH;

  let plateauW =
    MIN_ROOM_SIZE + Math.floor(rng() * (MAX_ROOM_SIZE_INCLUSIVE - MIN_ROOM_SIZE + 1));
  const plateauD =
    MIN_ROOM_SIZE + Math.floor(rng() * (MAX_ROOM_SIZE_INCLUSIVE - MIN_ROOM_SIZE + 1));

  let canyonW = 26 + Math.floor(rng() * 10);
  let canyonD = Math.ceil(SUNKEN_MIN_CANYON_AREA / canyonW);
  if (canyonW * canyonD < SUNKEN_MIN_CANYON_AREA) {
    canyonD = Math.ceil(SUNKEN_MIN_CANYON_AREA / canyonW);
  }
  canyonW = Math.max(canyonW, plateauW);

  let numRamps = 2 + Math.floor(rng() * 2);
  const rampW = PASSAGE_WIDTH;
  const rampD = 12 + Math.floor(rng() * 4);
  const edgeMargin = 1;

  function computeRampOffsets(roomWidth, rampCount) {
    const totalRampSpan = rampCount * rampW;
    const leftover = roomWidth - 2 * edgeMargin - totalRampSpan;
    if (leftover < 0) return null;
    const spacing = rampCount > 1 ? leftover / (rampCount - 1) : 0;
    const offsets = [];
    let x = -roomWidth / 2 + edgeMargin + rampW / 2;
    for (let i = 0; i < rampCount; i++) {
      offsets.push(x);
      if (i < rampCount - 1) x += rampW + spacing;
    }
    return offsets;
  }

  let rampOffsets = computeRampOffsets(plateauW, numRamps);
  while (!rampOffsets && numRamps > 2) {
    numRamps -= 1;
    rampOffsets = computeRampOffsets(plateauW, numRamps);
  }
  while (!rampOffsets && plateauW < MAX_ROOM_SIZE_INCLUSIVE) {
    plateauW += 1;
    rampOffsets = computeRampOffsets(plateauW, numRamps);
  }
  if (!rampOffsets) {
    numRamps = 2;
    rampOffsets = computeRampOffsets(plateauW, numRamps);
  }

  const plateauX = 0;
  const plateauZ = -48;
  const plateauSouthZ = plateauZ + plateauD / 2;

  const rampPassageGap = Math.min(passageWidth, rampW - 1);

  const ramps = rampOffsets.map(offsetX => {
    const ramp = createRampRoom({
      x: plateauX + offsetX,
      z: plateauSouthZ + rampD / 2,
      width: rampW,
      depth: rampD,
      axis: 'z',
      yHigh: SUNKEN_PLATEAU_Y,
      yLow: SUNKEN_CANYON_Y,
      passageGap: rampPassageGap,
      minSlope: MIN_RAMP_SLOPE,
    });
    openRampSouthPassage(ramp, rampPassageGap);
    ramp.elevationBand = 'ramp';
    return ramp;
  });

  const canyonNorthZ = plateauSouthZ + rampD;
  const canyonZ = canyonNorthZ + canyonD / 2;

  const plateau = createFlatBandRoom({
    x: plateauX,
    z: plateauZ,
    width: plateauW,
    depth: plateauD,
    y: SUNKEN_PLATEAU_Y,
    edgeGaps: { south: rampOffsets },
    gapWidth: rampPassageGap,
  });
  plateau.elevationBand = 'plateau';

  const canyon = createFlatBandRoom({
    x: plateauX,
    z: canyonZ,
    width: canyonW,
    depth: canyonD,
    y: SUNKEN_CANYON_Y,
    edgeGaps: { north: rampOffsets },
    gapWidth: rampPassageGap,
  });
  canyon.elevationBand = 'canyon';

  const rooms = [plateau, ...ramps, canyon];
  const passages = rampOffsets.flatMap(offsetX => {
    const rx = plateauX + offsetX;
    const rampNorthZ = plateauSouthZ;
    const rampSouthZ = plateauSouthZ + rampD;
    return [
      {
        x1: rx,
        z1: plateauSouthZ - 1,
        x2: rx,
        z2: rampNorthZ + 0.5,
        walls: [],
        corridorLength: 1.5,
      },
      {
        x1: rx,
        z1: rampSouthZ - 0.5,
        x2: rx,
        z2: canyonNorthZ + 1,
        walls: [],
        corridorLength: Math.max(1, canyonNorthZ - rampSouthZ + 1),
      },
    ];
  });

  const layout = {
    stage: 'sunken-canyon',
    rooms,
    passages,
    passageWidth,
    cellSpacing: 0,
    profile: 'sunken-canyon',
  };

  assignRoomRoles(layout);
  return layout;
}

/**
 * Generate a deterministic dungeon layout from a numeric seed.
 * Returns { rooms: [...], passages: [...], passageWidth, profile }
 *
 * @param {number} seed - PRNG seed for deterministic generation
 * @param {string|object} [profile=DEFAULT_LAYOUT_PROFILE] - Layout profile name or object
 * @param {object} [options={}] - Optional flags: { slopes: boolean, stage: string }
 */
function generateLayout(seed, profile = DEFAULT_LAYOUT_PROFILE, options = {}) {
  if (options.stage === 'sunken-canyon') {
    return generateSunkenCanyonLayout(seed, options);
  }

  const opts = normalizeLayoutProfile(profile);
  const rng = mulberry32(seed);
  const gridCols = opts.gridCols;
  const gridRows = opts.gridRows;
  const cellSpacing = opts.cellSpacing;
  const minRoomSize = opts.minRoomSize;
  const maxRoomSize = opts.maxRoomSize;
  const passageWidth = opts.passageWidth;
  const maxRooms = Math.min(opts.maxRooms, gridRows * gridCols);
  const targetRooms = Math.max(
    opts.minRooms,
    Math.min(maxRooms, Math.floor(gridRows * gridCols * opts.targetRoomFraction))
  );

  // Step 1 — place rooms by growth so every room is guaranteed connected
  // Start from a random seed cell, then repeatedly add a random unoccupied
  // neighbour of an existing room until we reach the target count.
  const grid = [];
  for (let r = 0; r < gridRows; r++) {
    grid[r] = new Array(gridCols).fill(false);
  }
  const cellPositions = []; // [{r, c, x, z}]

  const startR = Math.floor(rng() * gridRows);
  const startC = Math.floor(rng() * gridCols);
  const startZ = (startR - (gridRows - 1) / 2) * cellSpacing;
  const startX = (startC - (gridCols - 1) / 2) * cellSpacing;
  grid[startR][startC] = true;
  cellPositions.push({ r: startR, c: startC, x: startX, z: startZ });

  while (cellPositions.length < targetRooms) {
    // Build frontier: unoccupied neighbours of existing rooms
    const frontier = [];
    for (const cell of cellPositions) {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = cell.r + dr;
        const nc = cell.c + dc;
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && !grid[nr][nc]) {
          frontier.push({ r: nr, c: nc });
        }
      }
    }

    if (frontier.length === 0) break; // grid is full

    // Pick a random frontier cell and add it
    const pick = frontier[Math.floor(rng() * frontier.length)];
    grid[pick.r][pick.c] = true;
    const px = (pick.c - (gridCols - 1) / 2) * cellSpacing;
    const pz = (pick.r - (gridRows - 1) / 2) * cellSpacing;
    cellPositions.push({ r: pick.r, c: pick.c, x: px, z: pz });
  }

  // Step 2 — build connectivity via randomized DFS spanning tree
  // Adjacency: up/down/left/right
  const visited = new Set();
  const passages = []; // [{from, to}]  (from/to are indices into cellPositions)
  const key = (r, c) => `${r},${c}`;

  // Pick a random starting cell
  const startIdx = Math.floor(rng() * cellPositions.length);
  const stack = [startIdx];
  visited.add(startIdx);

  while (stack.length > 0) {
    const idx = stack[stack.length - 1];
    const cell = cellPositions[idx];
    const neighbors = [];

    // Check 4 neighbours
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = cell.r + dr;
      const nc = cell.c + dc;
      if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && grid[nr][nc]) {
        const nIdx = cellPositions.findIndex(cp => cp.r === nr && cp.c === nc);
        if (nIdx >= 0 && !visited.has(nIdx)) {
          neighbors.push(nIdx);
        }
      }
    }

    if (neighbors.length > 0) {
      // Pick a random unvisited neighbor
      const nextIdx = neighbors[Math.floor(rng() * neighbors.length)];
      stack.push(nextIdx);
      visited.add(nextIdx);
      passages.push({ from: idx, to: nextIdx });
    } else {
      stack.pop();
    }
  }

  // Step 3 — add a few extra edges for loops (up to 30 % of possible edges)
  const possibleExtra = [];
  for (const cell of cellPositions) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = cell.r + dr;
      const nc = cell.c + dc;
      if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && grid[nr][nc]) {
        const nIdx = cellPositions.findIndex(cp => cp.r === nr && cp.c === nc);
        const cIdx = cellPositions.indexOf(cell);
        if (nIdx >= 0 && cIdx < nIdx) { // avoid duplicates
          const exists = passages.some(p =>
            (p.from === cIdx && p.to === nIdx) || (p.from === nIdx && p.to === cIdx)
          );
          if (!exists) possibleExtra.push({ from: cIdx, to: nIdx });
        }
      }
    }
  }
  // Shuffle and pick a fraction
  for (let i = possibleExtra.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [possibleExtra[i], possibleExtra[j]] = [possibleExtra[j], possibleExtra[i]];
  }
  const extraCount = Math.min(Math.floor(possibleExtra.length * opts.extraEdgeFraction), possibleExtra.length);
  for (let i = 0; i < extraCount; i++) {
    passages.push(possibleExtra[i]);
  }

  // Step 4 — determine which sides each room uses for passage gaps
  // Map: cellIndex → Set of directions that have passages ('up','down','left','right')
  const passageSides = cellPositions.map(() => new Set());
  for (const p of passages) {
    const from = cellPositions[p.from];
    const to = cellPositions[p.to];
    if (to.r === from.r - 1) { passageSides[p.from].add('up'); passageSides[p.to].add('down'); }
    if (to.r === from.r + 1) { passageSides[p.from].add('down'); passageSides[p.to].add('up'); }
    if (to.c === from.c - 1) { passageSides[p.from].add('left'); passageSides[p.to].add('right'); }
    if (to.c === from.c + 1) { passageSides[p.from].add('right'); passageSides[p.to].add('left'); }
  }

  // Step 5 — build room objects with walls (gaps for passages)
  const rooms = cellPositions.map((cell, idx) => {
    const width = minRoomSize + Math.floor(rng() * (maxRoomSize - minRoomSize + 1));
    const depth = minRoomSize + Math.floor(rng() * (maxRoomSize - minRoomSize + 1));
    const halfW = width / 2;
    const halfD = depth / 2;
    const sides = passageSides[idx];
    const walls = [];
    const gap = passageWidth;

    // North wall (z = cell.z - halfD), along x-axis
    if (!sides.has('up')) {
      walls.push({ x: cell.x, z: cell.z - halfD, length: width, axis: 'x' });
    } else {
      const segLen = (width - gap) / 2;
      walls.push({ x: cell.x - gap / 2 - segLen / 2, z: cell.z - halfD, length: segLen, axis: 'x' });
      walls.push({ x: cell.x + gap / 2 + segLen / 2, z: cell.z - halfD, length: segLen, axis: 'x' });
    }

    // South wall (z = cell.z + halfD)
    if (!sides.has('down')) {
      walls.push({ x: cell.x, z: cell.z + halfD, length: width, axis: 'x' });
    } else {
      const segLen = (width - gap) / 2;
      walls.push({ x: cell.x - gap / 2 - segLen / 2, z: cell.z + halfD, length: segLen, axis: 'x' });
      walls.push({ x: cell.x + gap / 2 + segLen / 2, z: cell.z + halfD, length: segLen, axis: 'x' });
    }

    // West wall (x = cell.x - halfW), along z-axis
    if (!sides.has('left')) {
      walls.push({ x: cell.x - halfW, z: cell.z, length: depth, axis: 'z' });
    } else {
      const segLen = (depth - gap) / 2;
      walls.push({ x: cell.x - halfW, z: cell.z - gap / 2 - segLen / 2, length: segLen, axis: 'z' });
      walls.push({ x: cell.x - halfW, z: cell.z + gap / 2 + segLen / 2, length: segLen, axis: 'z' });
    }

    // East wall (x = cell.x + halfW)
    if (!sides.has('right')) {
      walls.push({ x: cell.x + halfW, z: cell.z, length: depth, axis: 'z' });
    } else {
      const segLen = (depth - gap) / 2;
      walls.push({ x: cell.x + halfW, z: cell.z - gap / 2 - segLen / 2, length: segLen, axis: 'z' });
      walls.push({ x: cell.x + halfW, z: cell.z + gap / 2 + segLen / 2, length: segLen, axis: 'z' });
    }

    return {
      x: cell.x,
      z: cell.z,
      width,
      depth,
      walls,
      floorCorners: {
        yNW: DEFAULT_FLOOR_Y,
        yNE: DEFAULT_FLOOR_Y,
        ySE: DEFAULT_FLOOR_Y,
        ySW: DEFAULT_FLOOR_Y,
      },
    };
  });

  // Step 5b — apply slope ramps when slopes option is enabled
  if (options.slopes) {
    // Pick 1-2 rooms to become ramps (RNG-driven, deterministic per seed).
    // Skip the start room (index 0) so the spawn area stays flat.
    const candidates = rooms.map((r, i) => i).filter(i => i > 0);
    const numRamps = Math.min(1 + Math.floor(rng() * 2), candidates.length);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (let i = 0; i < numRamps; i++) {
      const room = rooms[candidates[i]];
      // Southward ramp: north edge stays flat, south edge rises to 2.0
      room.floorCorners.yNW = DEFAULT_FLOOR_Y;
      room.floorCorners.yNE = DEFAULT_FLOOR_Y;
      room.floorCorners.ySE = 2.0;
      room.floorCorners.ySW = 2.0;
    }
  }

  // Step 6 — build passage objects with boundary walls
  const passageObjects = passages.map(p => {
    const from = cellPositions[p.from];
    const to = cellPositions[p.to];
    const fromRoom = rooms[p.from];
    const toRoom = rooms[p.to];
    const halfGap = passageWidth / 2;

    // Corridor length: the gap between the two connected rooms' edges.
    // Passage side walls must only span this gap — full cell spacing intrudes into rooms and blocks doorways.
    const corridorLength = (from.r === to.r)
      ? cellSpacing - fromRoom.width / 2 - toRoom.width / 2
      : cellSpacing - fromRoom.depth / 2 - toRoom.depth / 2;

    const walls = [];

    // Horizontal passage (same row, different column)
    if (from.r === to.r) {
      const wallCentreX = (from.x + to.x) / 2;
      walls.push({ x: wallCentreX, z: from.z - halfGap, length: corridorLength, axis: 'x' });
      walls.push({ x: wallCentreX, z: from.z + halfGap, length: corridorLength, axis: 'x' });
    }

    // Vertical passage (same column, different row)
    if (from.c === to.c) {
      const wallCentreZ = (from.z + to.z) / 2;
      walls.push({ x: from.x - halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' });
      walls.push({ x: from.x + halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' });
    }

    return { x1: from.x, z1: from.z, x2: to.x, z2: to.z, walls, corridorLength };
  });

  // Assign role metadata to every room
  assignRoomRoles({ rooms, passages: passageObjects });

  const profileName = typeof profile === 'string' && LAYOUT_PROFILES[profile]
    ? profile
    : 'default';

  return {
    rooms,
    passages: passageObjects,
    passageWidth,
    cellSpacing,
    profile: profileName,
  };
}

// ── Room Role Assignment ──

/**
 * Build an adjacency map from the layout's passages.
 * Returns Map<roomIndex, Set<neighborIndex>> keyed by room array index.
 */
function buildAdjacencyMap(layout) {
  const adj = new Map();
  for (let i = 0; i < layout.rooms.length; i++) {
    adj.set(i, new Set());
  }
  for (const p of layout.passages) {
    const fromIdx = layout.rooms.findIndex(r => r.x === p.x1 && r.z === p.z1);
    const toIdx = layout.rooms.findIndex(r => r.x === p.x2 && r.z === p.z2);
    if (fromIdx >= 0 && toIdx >= 0) {
      adj.get(fromIdx).add(toIdx);
      adj.get(toIdx).add(fromIdx);
    }
  }
  return adj;
}

/**
 * BFS from startIdx over the adjacency map.
 * Returns number[] where index = room index, value = hop distance (Infinity if unreachable).
 */
function bfsDistances(adjacencyMap, startIdx) {
  const dist = Array.from(adjacencyMap.keys()).map(() => Infinity);
  dist[startIdx] = 0;
  const queue = [startIdx];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentDist = dist[current];
    for (const neighbor of adjacencyMap.get(current)) {
      if (dist[neighbor] === Infinity) {
        dist[neighbor] = currentDist + 1;
        queue.push(neighbor);
      }
    }
  }
  return dist;
}

/**
 * Return the room farthest (by BFS hop count) from the given start room.
 * startRoom should be a room object from layout.rooms.
 * Ties are broken by lowest index (deterministic).
 */
function findFarthestRoom(layout, startRoom) {
  const startIdx = layout.rooms.indexOf(startRoom);
  const adj = buildAdjacencyMap(layout);
  const dist = bfsDistances(adj, startIdx);
  let maxDist = -1;
  let farthestIdx = startIdx;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > maxDist) {
      maxDist = dist[i];
      farthestIdx = i;
    }
  }
  return layout.rooms[farthestIdx];
}

/**
 * Assign role metadata to every room in the layout.
 * Mutates each room, adding: role, spawnWeight, encounterTier.
 * - start room (index 0): role 'start', spawnWeight 0, encounterTier 0
 * - farthest room: role 'treasure', spawnWeight 2, encounterTier 0
 * - all others: role 'combat', spawnWeight 1, encounterTier = distance / maxDistance
 */
function assignRoomRoles(layout) {
  const adj = buildAdjacencyMap(layout);
  const startIdx = 0;
  const dist = bfsDistances(adj, startIdx);

  // Find the farthest room (same logic as findFarthestRoom)
  let maxDist = 0;
  for (let i = 1; i < dist.length; i++) {
    if (dist[i] > maxDist) {
      maxDist = dist[i];
    }
  }
  let treasureIdx = startIdx;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] === maxDist) {
      treasureIdx = i;
      break;
    }
  }

  for (let i = 0; i < layout.rooms.length; i++) {
    const room = layout.rooms[i];
    if (i === startIdx) {
      room.role = 'start';
      room.spawnWeight = 0;
      room.encounterTier = 0;
    } else if (i === treasureIdx) {
      room.role = 'treasure';
      room.spawnWeight = 2;
      room.encounterTier = 0;
    } else {
      room.role = 'combat';
      room.spawnWeight = 1;
      // Normalized distance from start, clamped 0–1
      room.encounterTier = maxDist > 0 ? Math.min(1, dist[i] / maxDist) : 0;
    }
  }
}

// ── Role-Aware Spawn Helpers ──

const SPAWN_PADDING = 2;

/**
 * Return rooms from the layout matching the given role string.
 */
function roomsByRole(layout, role) {
  return layout.rooms.filter(r => r.role === role);
}

/**
 * Return a random position {x, z} within a room of the specified role.
 * Uses a seeded RNG (Mulberry32) for determinism.
 * Falls back to any room when no rooms match the requested role.
 */
function randomRoomPositionByRole(layout, role, rng) {
  const matched = roomsByRole(layout, role);
  const pool = matched.length > 0 ? matched : layout.rooms;
  const room = pool[Math.floor(rng() * pool.length)];
  const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
  const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
  return {
    x: room.x + (rng() * 2 - 1) * halfW,
    z: room.z + (rng() * 2 - 1) * halfD,
  };
}

// ── Exports ──

module.exports = {
  mulberry32,
  generateLayout,
  generateSunkenCanyonLayout,
  buildAdjacencyMap,
  bfsDistances,
  findFarthestRoom,
  assignRoomRoles,
  roomsByRole,
  randomRoomPositionByRole,
  sampleFloorY,
  questLayoutSeed,
  normalizeLayoutProfile,
  DEFAULT_LAYOUT_PROFILE,
  DEFAULT_FLOOR_Y,
  LAYOUT_PROFILES,
  GRID_COLS,
  GRID_ROWS,
  CELL_SPACING,
  MIN_ROOM_SIZE,
  MAX_ROOM_SIZE_INCLUSIVE,
  PASSAGE_WIDTH,
  createRampRoom,
  averageRampSlope,
  validateRampSlope,
  inferRampAxis,
  MIN_RAMP_SLOPE,
  SUNKEN_PLATEAU_Y,
  SUNKEN_CANYON_Y,
  SUNKEN_MIN_CANYON_AREA,
};
