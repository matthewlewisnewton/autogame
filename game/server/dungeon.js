// ── Floor Height Sampling (imported from shared module) ──

const { sampleFloorY, DEFAULT_FLOOR_Y } = require('../shared/floorSampling.js');

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

// Open-plaza arena side length. 40×40 = 1600 sq units, comfortably ≥ the
// required 4 * MAX_ROOM_SIZE_INCLUSIVE^2 = 900 sq units floor-area bound.
const OPEN_PLAZA_SIZE = 40;

// ── Open-plaza cover pieces ──

// Freestanding cover archetypes scattered through the plaza. `pillar` is a tall
// box you fully hide behind; `brokenWall` and `planter` are low boxes for
// partial cover. Footprints are deliberately small relative to the 40×40 arena
// so the free floor stays one connected region (verified by the BFS guard).
const COVER_TYPES = [
  { type: 'pillar', width: 2, depth: 2, height: 3.0 },
  { type: 'brokenWall', width: 4, depth: 1, height: 1.2 },
  { type: 'planter', width: 2.5, depth: 2.5, height: 0.8 },
];

const COVER_TARGET = 8;          // try to place this many pieces
const COVER_MIN = 6;             // acceptance floor (sub-ticket requires ≥ 6)
const COVER_SLOPED = 2;          // ≥ 2 pieces sit on a gently sloped platform
const COVER_WALL_MARGIN = 2;     // keep footprints this far inside the inner wall face
const COVER_SPAWN_CLEAR = 4;     // keep cover at least this far from the spawn point
const COVER_PIECE_GAP = 1.5;     // min gap between cover footprints (> player diameter)
const COVER_MAX_ATTEMPTS = 600;  // bound the placement loop for determinism
const COVER_SLOPE_DELTA = 0.5;   // gentle corner-height delta (must stay ≤ 0.6)
const PLAYER_RADIUS = 0.5;       // matches simulation.js PLAYER_RADIUS for guards

/**
 * Axis-aligned footprint bounds of a cover piece, optionally inflated by `pad`.
 */
function coverBounds(piece, pad = 0) {
  return {
    minX: piece.x - piece.width / 2 - pad,
    maxX: piece.x + piece.width / 2 + pad,
    minZ: piece.z - piece.depth / 2 - pad,
    maxZ: piece.z + piece.depth / 2 + pad,
  };
}

function pointInBounds(x, z, b) {
  return x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
}

function boundsOverlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/**
 * Grid BFS over the plaza interior with the given cover footprints removed
 * (each inflated by the player radius so the check mirrors real walkability).
 * Returns true when every free cell is reachable from the spawn cell — i.e. the
 * free floor remains a single connected region.
 */
function plazaFreeFloorConnected(plazaSize, cover, spawn) {
  const STEP = 1;
  const half = plazaSize / 2;
  const limit = half - PLAYER_RADIUS; // stay off the perimeter walls
  const blocked = cover.map(c => coverBounds(c, PLAYER_RADIUS));
  const isFree = (x, z) => !blocked.some(b => pointInBounds(x, z, b));

  // Enumerate free cells on a regular grid.
  const cells = [];
  const index = new Map();
  const key = (ix, iz) => `${ix},${iz}`;
  let ix = 0;
  for (let x = -limit; x <= limit + 1e-9; x += STEP, ix++) {
    let iz = 0;
    for (let z = -limit; z <= limit + 1e-9; z += STEP, iz++) {
      if (isFree(x, z)) {
        index.set(key(ix, iz), cells.length);
        cells.push({ ix, iz, x, z });
      }
    }
  }
  if (cells.length === 0) return false;

  // Pick the free cell nearest the spawn as the BFS root.
  let rootIdx = 0;
  let best = Infinity;
  for (let i = 0; i < cells.length; i++) {
    const d = Math.hypot(cells[i].x - spawn.x, cells[i].z - spawn.z);
    if (d < best) { best = d; rootIdx = i; }
  }

  const seen = new Set([rootIdx]);
  const queue = [rootIdx];
  let head = 0;
  while (head < queue.length) {
    const c = cells[queue[head++]];
    const neighbours = [
      [c.ix + 1, c.iz], [c.ix - 1, c.iz],
      [c.ix, c.iz + 1], [c.ix, c.iz - 1],
    ];
    for (const [nx, nz] of neighbours) {
      const ni = index.get(key(nx, nz));
      if (ni !== undefined && !seen.has(ni)) {
        seen.add(ni);
        queue.push(ni);
      }
    }
  }

  return seen.size === cells.length;
}

/**
 * Deterministically scatter freestanding cover pieces through the plaza
 * interior using the layout `rng`. Each piece is fully inside the outer walls,
 * does not overlap other pieces or the spawn point, and preserves
 * traversability (a re-roll guard skips any piece that would split the free
 * floor). The first COVER_SLOPED accepted pieces carry a gently sloped
 * `floorCorners` platform (corner-height delta = COVER_SLOPE_DELTA ≤ 0.6).
 *
 * @param {() => number} rng - seeded PRNG (Mulberry32)
 * @param {number} plazaSize - arena side length
 * @param {{x:number,z:number}} spawn - spawn point to keep clear
 */
function generatePlazaCover(rng, plazaSize, spawn) {
  const half = plazaSize / 2;
  const spawnClear = {
    minX: spawn.x - COVER_SPAWN_CLEAR,
    maxX: spawn.x + COVER_SPAWN_CLEAR,
    minZ: spawn.z - COVER_SPAWN_CLEAR,
    maxZ: spawn.z + COVER_SPAWN_CLEAR,
  };

  const cover = [];
  let attempts = 0;
  while (cover.length < COVER_TARGET && attempts < COVER_MAX_ATTEMPTS) {
    attempts++;
    const archetype = COVER_TYPES[Math.floor(rng() * COVER_TYPES.length)];
    // Broken walls can sit on either axis for variety.
    let width = archetype.width;
    let depth = archetype.depth;
    if (archetype.type === 'brokenWall' && rng() < 0.5) {
      width = archetype.depth;
      depth = archetype.width;
    }
    const limitX = half - COVER_WALL_MARGIN - width / 2;
    const limitZ = half - COVER_WALL_MARGIN - depth / 2;
    const x = (rng() * 2 - 1) * limitX;
    const z = (rng() * 2 - 1) * limitZ;
    const piece = { x, z, width, depth, height: archetype.height, type: archetype.type };
    const pieceBounds = coverBounds(piece);

    // Keep the spawn point and its clearance free of cover.
    if (boundsOverlap(pieceBounds, spawnClear)) continue;
    // Don't overlap (or crowd) an already-placed piece.
    if (cover.some(c => boundsOverlap(pieceBounds, coverBounds(c, COVER_PIECE_GAP)))) continue;
    // Reject anything that would split the free floor into disconnected regions.
    if (!plazaFreeFloorConnected(plazaSize, [...cover, piece], spawn)) continue;

    cover.push(piece);
  }

  // Attach gently sloped platforms to the first COVER_SLOPED pieces. The slope
  // is visual-only for v1 (sloped movement is ticket 117); we only need the
  // floorCorners data and a corner-height delta within the documented bound.
  for (let i = 0; i < Math.min(COVER_SLOPED, cover.length); i++) {
    cover[i].floorCorners = {
      yNW: DEFAULT_FLOOR_Y,
      yNE: DEFAULT_FLOOR_Y,
      ySE: DEFAULT_FLOOR_Y + COVER_SLOPE_DELTA,
      ySW: DEFAULT_FLOOR_Y + COVER_SLOPE_DELTA,
    };
  }

  return cover;
}

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
  // The open-plaza stage is built by generateOpenPlaza() rather than the grid
  // growth path; this entry registers the key so profile lookups recognise it.
  'open-plaza': {
    ...DEFAULT_LAYOUT_PROFILE,
    plazaSize: OPEN_PLAZA_SIZE,
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

/**
 * Generate a deterministic dungeon layout from a numeric seed.
 * Returns { rooms: [...], passages: [...], passageWidth, profile }
 *
 * @param {number} seed - PRNG seed for deterministic generation
 * @param {string|object} [profile=DEFAULT_LAYOUT_PROFILE] - Layout profile name or object
 * @param {object} [options={}] - Optional flags: { slopes: boolean }
 */
function generateLayout(seed, profile = DEFAULT_LAYOUT_PROFILE, options = {}) {
  // The open-plaza stage is a single bounded arena, not a rooms-and-passages
  // grid, so branch out early to its dedicated generator.
  if (profile === 'open-plaza') {
    return generateOpenPlaza(seed, options);
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

/**
 * Generate the open-plaza stage: a single large bounded arena room with a
 * continuous, gapless outer wall perimeter and no passages. Returns the same
 * layout shape as generateLayout().
 *
 * @param {number} seed - PRNG seed (threaded for signature parity / future
 *   seeded variation; the empty plaza itself is fixed, so output is identical
 *   for any seed and therefore trivially deterministic).
 * @param {object} [options={}] - Optional flags (e.g. slopes). The plaza floor
 *   itself stays flat; sloped platforms ride on individual cover pieces.
 */
function generateOpenPlaza(seed, options = {}) {
  void options;
  const rng = mulberry32(seed);
  const size = OPEN_PLAZA_SIZE;
  const halfW = size / 2;
  const halfD = size / 2;
  const cx = 0;
  const cz = 0;

  // Continuous outer perimeter: each of the four sides is one full-length wall
  // segment with NO passage gaps, so the arena is fully enclosed and players
  // cannot exit the level.
  const walls = [
    { x: cx, z: cz - halfD, length: size, axis: 'x' }, // north
    { x: cx, z: cz + halfD, length: size, axis: 'x' }, // south
    { x: cx - halfW, z: cz, length: size, axis: 'z' }, // west
    { x: cx + halfW, z: cz, length: size, axis: 'z' }, // east
  ];

  const rooms = [{
    x: cx,
    z: cz,
    width: size,
    depth: size,
    walls,
    // Flat floor for now; cover pieces and slopes arrive in later sub-tickets.
    floorCorners: {
      yNW: DEFAULT_FLOOR_Y,
      yNE: DEFAULT_FLOOR_Y,
      ySE: DEFAULT_FLOOR_Y,
      ySW: DEFAULT_FLOOR_Y,
    },
  }];

  const passages = [];

  // Reuse shared role assignment. With a single room it resolves to role
  // 'start' (index 0), so firstRoomPosition()/spawn returns the plaza centre.
  // Because there is no 'combat' or 'treasure' room, roomsByRole() returns []
  // and randomRoomPositionByRole()/randomRoomPosition() fall back to the only
  // room — the plaza — keeping every spawn/objective point on the plaza floor.
  assignRoomRoles({ rooms, passages });

  // Scatter freestanding cover through the plaza interior. The spawn point is
  // the plaza centre (the single 'start' room resolves to origin), so we keep
  // cover clear of it.
  const spawn = { x: cx, z: cz };
  const cover = generatePlazaCover(rng, size, spawn);

  return {
    rooms,
    passages,
    cover,
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: CELL_SPACING,
    profile: 'open-plaza',
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
  generateOpenPlaza,
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
  OPEN_PLAZA_SIZE,
  generatePlazaCover,
  plazaFreeFloorConnected,
  COVER_MIN,
  COVER_TARGET,
  COVER_SLOPED,
  COVER_SLOPE_DELTA
};
