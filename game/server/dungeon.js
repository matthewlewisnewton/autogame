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

// Open-plaza arena tuning. Unlike the grid profiles, the plaza is a single
// large room built by generateOpenPlaza() rather than the room/passage path,
// so these are plaza-specific constants rather than grid parameters.
const OPEN_PLAZA = {
  size: 32,                 // 32 × 32 ⇒ 1024 units² walkable (≥ 4× a ~182 unit² room)
  spawnClearRadius: 6,      // keep cover/platforms out of this circle around centre
  interiorMargin: 2,        // cover must stay this far inside the perimeter walls
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
  // The open-plaza profile is handled by a dedicated branch in generateLayout()
  // (see generateOpenPlaza). The entry exists so the string profile resolves
  // here instead of silently falling back to 'crowded'.
  'open-plaza': {
    ...DEFAULT_LAYOUT_PROFILE,
    cellSpacing: OPEN_PLAZA.size,
  },
  'sunken-canyon': {
    ...DEFAULT_LAYOUT_PROFILE,
    cellSpacing: 40,
  },
};

// Sunken-canyon stage tuning (see generateSunkenCanyon).
const SUNKEN_CANYON = {
  yPlateau: 10,
  yCanyon: 1,
  plateauSize: 14,
  canyonSize: 32,
  rampWidth: 5,
  rampMinDepth: 20,
  // Canyon-floor cover: same spawn-clear / perimeter margin as open-plaza.
  coverSpawnClearRadius: OPEN_PLAZA.spawnClearRadius,
  coverInteriorMargin: OPEN_PLAZA.interiorMargin,
  coverTarget: 8,
};

/** Low vista walls on the plateau edge facing the canyon (≤ client WALL_HEIGHT). */
const PARAPET_WALL_HEIGHT = 1.2;

const DEFAULT_ROOM_FOOTPRINT_AREA = 13.5 * 13.5;
const MIN_CANYON_AREA = 4 * DEFAULT_ROOM_FOOTPRINT_AREA;

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
 * Generate a deterministic dungeon layout.
 *
 * Two calling conventions are supported:
 * - `generateLayout(seed, [profile], [options])` — legacy numeric seed first
 * - `generateLayout({ stage, seed?, options? })` — object stage selector; when
 *   `seed` is omitted, uses `questLayoutSeed(stage)` (e.g. `questLayoutSeed('sunken-canyon')`)
 *
 * Returns { rooms, passages, passageWidth, profile, ... } (shape varies by profile).
 *
 * @param {number|object} seedOrOpts - PRNG seed, or `{ stage: string, seed?: number, options?: object }`
 * @param {string|object} [profile=DEFAULT_LAYOUT_PROFILE] - Layout profile name or object
 * @param {object} [options={}] - Optional flags: { slopes: boolean }
 */
function generateLayout(seedOrOpts, profile = DEFAULT_LAYOUT_PROFILE, options = {}) {
  if (
    seedOrOpts !== null &&
    typeof seedOrOpts === 'object' &&
    !Array.isArray(seedOrOpts) &&
    typeof seedOrOpts.stage === 'string'
  ) {
    const { stage, seed: explicitSeed } = seedOrOpts;
    if (stage === 'sunken-canyon') {
      const resolvedSeed =
        explicitSeed !== undefined ? explicitSeed : questLayoutSeed('sunken-canyon');
      return generateSunkenCanyon(resolvedSeed);
    }
  }

  const seed = seedOrOpts;

  // Open-plaza is a bespoke single-arena layout, not a grid of rooms/passages.
  if (profile === 'open-plaza') {
    return generateOpenPlaza(seed);
  }
  if (profile === 'sunken-canyon') {
    return generateSunkenCanyon(seed);
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

// ── Open Plaza Arena Generation ──

/**
 * Axis-aligned rectangle (footprint) overlap test with an optional margin.
 * a/b are { x, z, width, depth }.
 */
function footprintsOverlap(a, b, margin = 0) {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + margin &&
    Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + margin
  );
}

/**
 * True when a footprint's AABB intersects the spawn-clear circle of `radius`
 * centred on `(centerX, centerZ)` (plaza/canyon room centre).
 */
function overlapsSpawnClear(piece, radius, centerX = 0, centerZ = 0) {
  const dx = Math.max(Math.abs(piece.x - centerX) - piece.width / 2, 0);
  const dz = Math.max(Math.abs(piece.z - centerZ) - piece.depth / 2, 0);
  return dx * dx + dz * dz < radius * radius;
}

/**
 * Grid flood-fill from `(centerX, centerZ)` over a square interior of side `2*half`,
 * treating any cell whose centre falls inside a cover footprint as blocked.
 * Returns true only when every open interior cell is reachable — i.e. cover never
 * fully partitions the walkable floor.
 */
function interiorFullyReachable(cover, half, centerX = 0, centerZ = 0) {
  const step = 0.5;
  const cells = Math.floor((half * 2) / step);
  const cellCentre = i => centerX - half + (i + 0.5) * step;
  const cellCentreZ = j => centerZ - half + (j + 0.5) * step;
  const isBlocked = (x, z) =>
    cover.some(c =>
      x >= c.x - c.width / 2 && x <= c.x + c.width / 2 &&
      z >= c.z - c.depth / 2 && z <= c.z + c.depth / 2
    );

  const startI = Math.floor(half / step);
  const startJ = startI;
  if (isBlocked(cellCentre(startI), cellCentreZ(startJ))) return false;

  const seen = new Uint8Array(cells * cells);
  const idx = (i, j) => j * cells + i;
  const queue = [[startI, startJ]];
  seen[idx(startI, startJ)] = 1;
  let reached = 0;
  while (queue.length > 0) {
    const [i, j] = queue.pop();
    reached++;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || ni >= cells || nj < 0 || nj >= cells) continue;
      if (seen[idx(ni, nj)]) continue;
      if (isBlocked(cellCentre(ni), cellCentreZ(nj))) continue;
      seen[idx(ni, nj)] = 1;
      queue.push([ni, nj]);
    }
  }

  let open = 0;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      if (!isBlocked(cellCentre(i), cellCentreZ(j))) open++;
    }
  }
  return reached === open;
}

/** Open-plaza reachability (centre at origin). */
function plazaFullyReachable(cover, half) {
  return interiorFullyReachable(cover, half, 0, 0);
}

/**
 * Fisher–Yates scatter of cover inside a square room interior. Offsets in
 * `candidatePool` are relative to `(centerX, centerZ)`.
 */
function scatterInteriorCover({
  rng,
  centerX,
  centerZ,
  half,
  spawnClearRadius,
  interiorMargin,
  candidatePool,
  targetCover,
  initialCover = [],
}) {
  const interiorMax = half - interiorMargin;
  const cover = [...initialCover];
  const pool = candidatePool.map(c => ({
    ...c,
    x: centerX + c.x,
    z: centerZ + c.z,
  }));

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  for (const cand of pool) {
    if (cover.length >= targetCover) break;
    if (Math.abs(cand.x - centerX) + cand.width / 2 > interiorMax) continue;
    if (Math.abs(cand.z - centerZ) + cand.depth / 2 > interiorMax) continue;
    if (overlapsSpawnClear(cand, spawnClearRadius, centerX, centerZ)) continue;
    if (cover.some(c => footprintsOverlap(cand, c, 0.5))) continue;
    if (!interiorFullyReachable([...cover, cand], half, centerX, centerZ)) continue;
    cover.push({ ...cand });
  }

  return cover;
}

/**
 * Build the open-plaza arena: one large walkable room bounded by four solid
 * perimeter walls, with scattered cover pieces and a couple of gently sloped
 * platforms. Deterministic for a given seed (uses mulberry32).
 *
 * Returns { rooms: [plaza], passages: [], cover, platforms, passageWidth,
 *           cellSpacing, profile: 'open-plaza' }.
 */
function generateOpenPlaza(seed) {
  const rng = mulberry32(seed);
  const size = OPEN_PLAZA.size;
  const half = size / 2;
  const spawnClear = OPEN_PLAZA.spawnClearRadius;

  // Four full perimeter walls — no passage gaps, so players cannot exit.
  const walls = [
    { x: 0, z: -half, length: size, axis: 'x' }, // north
    { x: 0, z: half, length: size, axis: 'x' },  // south
    { x: -half, z: 0, length: size, axis: 'z' }, // west
    { x: half, z: 0, length: size, axis: 'z' },  // east
  ];

  const plaza = {
    x: 0,
    z: 0,
    width: size,
    depth: size,
    walls,
    floorCorners: {
      yNW: DEFAULT_FLOOR_Y,
      yNE: DEFAULT_FLOOR_Y,
      ySE: DEFAULT_FLOOR_Y,
      ySW: DEFAULT_FLOOR_Y,
    },
  };

  // Two gently sloped platforms (corner heights differ by ≤ 0.5 units).
  const platforms = [
    { x: -9, z: -9, width: 6, depth: 6, floorCorners: { yNW: 1.0, yNE: 1.3, ySE: 1.4, ySW: 1.1 } },
    { x: 9, z: 9, width: 6, depth: 6, floorCorners: { yNW: 1.4, yNE: 1.1, ySE: 1.2, ySW: 1.3 } },
  ];

  // Cover set. Start with one pillar centred on each platform so at least two
  // cover pieces sit on a platform, then greedily add scattered pieces.
  const cover = platforms.map(p => ({
    x: p.x, z: p.z, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar',
  }));

  const candidatePool = [
    { x: 0, z: -11, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 0, z: 11, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: -11, z: 0, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 11, z: 0, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 9, z: -9, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: -9, z: 9, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: -11, z: -11, width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
    { x: 11, z: 11, width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
  ];

  const scattered = scatterInteriorCover({
    rng,
    centerX: 0,
    centerZ: 0,
    half,
    spawnClearRadius: spawnClear,
    interiorMargin: OPEN_PLAZA.interiorMargin,
    candidatePool,
    targetCover: 8,
    initialCover: cover,
  });
  cover.length = 0;
  cover.push(...scattered);

  const layout = {
    rooms: [plaza],
    passages: [],
    cover,
    platforms,
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: size,
    profile: 'open-plaza',
  };

  // assignRoomRoles marks index 0 as 'start' and works with empty passages.
  // With a single plaza room there is no separate 'combat'/'treasure' room, so
  // roomsByRole('combat')/'treasure' return [] and callers fall back to the
  // plaza — enemies and objectives then place across the open floor.
  assignRoomRoles(layout);

  return layout;
}

// ── Sunken Canyon Stage Generation ──

/**
 * Build wall segments along one rectangular room edge, leaving passage gaps.
 * gapCenters are positions along the edge (x for north/south, z for east/west).
 */
function buildRoomEdgeWalls(room, edge, { gapCenters = [], gapWidth = PASSAGE_WIDTH, parapet = false } = {}) {
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const wallOpts = parapet ? { height: PARAPET_WALL_HEIGHT } : {};

  if (edge === 'north') {
    return buildGappedWallAlongAxis({
      axis: 'x',
      fixedCoord: room.z - halfD,
      centerAlong: room.x,
      totalLength: room.width,
      gapCenters,
      gapWidth,
      wallOpts,
    });
  }
  if (edge === 'south') {
    return buildGappedWallAlongAxis({
      axis: 'x',
      fixedCoord: room.z + halfD,
      centerAlong: room.x,
      totalLength: room.width,
      gapCenters,
      gapWidth,
      wallOpts,
    });
  }
  if (edge === 'west') {
    return buildGappedWallAlongAxis({
      axis: 'z',
      fixedCoord: room.x - halfW,
      centerAlong: room.z,
      totalLength: room.depth,
      gapCenters,
      gapWidth,
      wallOpts,
    });
  }
  if (edge === 'east') {
    return buildGappedWallAlongAxis({
      axis: 'z',
      fixedCoord: room.x + halfW,
      centerAlong: room.z,
      totalLength: room.depth,
      gapCenters,
      gapWidth,
      wallOpts,
    });
  }
  return [];
}

function buildGappedWallAlongAxis({
  axis,
  fixedCoord,
  centerAlong,
  totalLength,
  gapCenters,
  gapWidth,
  wallOpts,
}) {
  const half = totalLength / 2;
  const minAlong = centerAlong - half;
  const maxAlong = centerAlong + half;
  const sortedGaps = [...gapCenters].sort((a, b) => a - b);
  const walls = [];
  let cursor = minAlong;

  for (const gc of sortedGaps) {
    const gapHalf = gapWidth / 2;
    const gapStart = gc - gapHalf;
    const gapEnd = gc + gapHalf;
    if (gapStart > cursor) {
      const segLen = gapStart - cursor;
      const segMid = cursor + segLen / 2;
      if (axis === 'x') {
        walls.push({ x: segMid, z: fixedCoord, length: segLen, axis: 'x', ...wallOpts });
      } else {
        walls.push({ x: fixedCoord, z: segMid, length: segLen, axis: 'z', ...wallOpts });
      }
    }
    cursor = Math.max(cursor, gapEnd);
  }

  if (cursor < maxAlong) {
    const segLen = maxAlong - cursor;
    const segMid = cursor + segLen / 2;
    if (axis === 'x') {
      walls.push({ x: segMid, z: fixedCoord, length: segLen, axis: 'x', ...wallOpts });
    } else {
      walls.push({ x: fixedCoord, z: segMid, length: segLen, axis: 'z', ...wallOpts });
    }
  }

  return walls;
}

/**
 * Shared descending ramp room for sunken-canyon (137) and future spire (136).
 * axis 'z': high edge on north (−Z), low edge on south (+Z).
 * axis 'x': high edge on west (−X), low edge on east (+X).
 */
function createDescendingRampRoom({ x, z, width, depth, yHigh, yLow, axis = 'z' }) {
  const halfW = width / 2;
  const halfD = depth / 2;
  let floorCorners;
  if (axis === 'x') {
    floorCorners = { yNW: yHigh, ySW: yHigh, yNE: yLow, ySE: yLow };
  } else {
    floorCorners = { yNW: yHigh, yNE: yHigh, ySE: yLow, ySW: yLow };
  }

  const walls = [
    { x: x - halfW, z, length: depth, axis: 'z' },
    { x: x + halfW, z, length: depth, axis: 'z' },
  ];

  return {
    x,
    z,
    width,
    depth,
    walls,
    floorCorners,
    band: 'ramp',
  };
}

/**
 * Average slope ΔY / horizontal run along the primary descent axis.
 */
function averageRampSlope(room) {
  const { yNW, yNE, ySE, ySW } = room.floorCorners;
  const northAvg = (yNW + yNE) / 2;
  const southAvg = (ySE + ySW) / 2;
  const westAvg = (yNW + ySW) / 2;
  const eastAvg = (yNE + ySE) / 2;
  const dz = Math.abs(northAvg - southAvg);
  const dx = Math.abs(westAvg - eastAvg);
  if (dz >= dx) {
    return dz / room.depth;
  }
  return dx / room.width;
}

function sunkenCanyonRampXPositions(numRamps, rng) {
  if (numRamps === 2) {
    const flip = rng() < 0.5 ? -1 : 1;
    return [-5 * flip, 5 * flip];
  }
  return [-5, 0, 5];
}

function buildSunkenCanyonPassage(fromRoom, toRoom, passageWidth) {
  const halfGap = passageWidth / 2;
  const dz = toRoom.z - fromRoom.z;
  const dx = toRoom.x - fromRoom.x;
  const corridorLength = Math.hypot(dx, dz);
  const walls = [];

  if (Math.abs(dx) >= Math.abs(dz)) {
    const wallCentreX = (fromRoom.x + toRoom.x) / 2;
    const z = fromRoom.z;
    walls.push({ x: wallCentreX, z: z - halfGap, length: corridorLength, axis: 'x' });
    walls.push({ x: wallCentreX, z: z + halfGap, length: corridorLength, axis: 'x' });
  } else {
    const wallCentreZ = (fromRoom.z + toRoom.z) / 2;
    const x = fromRoom.x;
    walls.push({ x: x - halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' });
    walls.push({ x: x + halfGap, z: wallCentreZ, length: corridorLength, axis: 'z' });
  }

  return {
    x1: fromRoom.x,
    z1: fromRoom.z,
    x2: toRoom.x,
    z2: toRoom.z,
    walls,
    corridorLength,
  };
}

/**
 * Deterministic sunken-canyon layout: elevated plateau spawn, large lower canyon,
 * and 2–3 sloped ramp connectors.
 */
function generateSunkenCanyon(seed) {
  const rng = mulberry32(seed);
  const { yPlateau, yCanyon, plateauSize, canyonSize, rampWidth } = SUNKEN_CANYON;
  const numRamps = 2 + Math.floor(rng() * 2);
  const rampXs = sunkenCanyonRampXPositions(numRamps, rng);

  const plateauHalf = plateauSize / 2;
  const canyonHalf = canyonSize / 2;

  const plateau = {
    x: 0,
    z: -50,
    width: plateauSize,
    depth: plateauSize,
    walls: [],
    floorCorners: {
      yNW: yPlateau,
      yNE: yPlateau,
      ySE: yPlateau,
      ySW: yPlateau,
    },
    band: 'plateau',
  };

  const canyon = {
    x: 0,
    z: 28,
    width: canyonSize,
    depth: canyonSize,
    walls: [],
    floorCorners: {
      yNW: yCanyon,
      yNE: yCanyon,
      ySE: yCanyon,
      ySW: yCanyon,
    },
    band: 'canyon',
  };

  const plateauSouthZ = plateau.z + plateauHalf;
  const canyonNorthZ = canyon.z - canyonHalf;
  const rampSpan = canyonNorthZ - plateauSouthZ;
  const rampDepth = Math.max(SUNKEN_CANYON.rampMinDepth, rampSpan);
  const rampCenterZ = (plateauSouthZ + canyonNorthZ) / 2;

  const ramps = rampXs.map((rx) =>
    createDescendingRampRoom({
      x: rx,
      z: rampCenterZ,
      width: rampWidth,
      depth: rampDepth,
      yHigh: yPlateau,
      yLow: yCanyon,
      axis: 'z',
    })
  );

  plateau.walls = [
    ...buildRoomEdgeWalls(plateau, 'north'),
    ...buildRoomEdgeWalls(plateau, 'west'),
    ...buildRoomEdgeWalls(plateau, 'east'),
    ...buildRoomEdgeWalls(plateau, 'south', { gapCenters: rampXs, parapet: true }),
  ];

  canyon.walls = [
    ...buildRoomEdgeWalls(canyon, 'north', { gapCenters: rampXs }),
    ...buildRoomEdgeWalls(canyon, 'south'),
    ...buildRoomEdgeWalls(canyon, 'west'),
    ...buildRoomEdgeWalls(canyon, 'east'),
  ];

  const rooms = [plateau, ...ramps, canyon];
  const rampRoomIndices = ramps.map((_, i) => i + 1);
  const canyonRoomIndex = rooms.length - 1;

  const passages = [];
  for (const ramp of ramps) {
    passages.push(buildSunkenCanyonPassage(plateau, ramp, PASSAGE_WIDTH));
    passages.push(buildSunkenCanyonPassage(ramp, canyon, PASSAGE_WIDTH));
  }

  const canyonCoverPool = [
    { x: 0, z: -11, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 0, z: 11, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: -11, z: 0, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 11, z: 0, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: -9, z: -9, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: 9, z: 9, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: -11, z: -11, width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
    { x: 11, z: 11, width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
    { x: -7, z: 7, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 7, z: -7, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
  ];

  const cover = scatterInteriorCover({
    rng,
    centerX: canyon.x,
    centerZ: canyon.z,
    half: canyonHalf,
    spawnClearRadius: SUNKEN_CANYON.coverSpawnClearRadius,
    interiorMargin: SUNKEN_CANYON.coverInteriorMargin,
    candidatePool: canyonCoverPool,
    targetCover: SUNKEN_CANYON.coverTarget,
  });

  const layout = {
    rooms,
    passages,
    cover,
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: SUNKEN_CANYON.canyonSize,
    profile: 'sunken-canyon',
    stageMeta: {
      plateauRoomIndex: 0,
      canyonRoomIndex,
      rampRoomIndices,
    },
  };

  assignRoomRoles(layout);

  for (const idx of rampRoomIndices) {
    layout.rooms[idx].role = 'combat';
    layout.rooms[idx].spawnWeight = 0;
  }

  layout.rooms[0].role = 'start';
  layout.rooms[0].spawnWeight = 0;
  layout.rooms[canyonRoomIndex].role = 'treasure';
  layout.rooms[canyonRoomIndex].spawnWeight = 2;

  return layout;
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
 * For the single-room open-plaza layout no room has role 'combat'/'treasure',
 * so this returns [] for those roles and callers (randomRoomPositionByRole)
 * fall back to the plaza, placing enemies/objectives across the open floor.
 */
function roomsByRole(layout, role) {
  return layout.rooms.filter(r => r.role === role);
}

function roomsByBand(layout, band) {
  return layout.rooms.filter(r => r.band === band);
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
  generateSunkenCanyon,
  createDescendingRampRoom,
  averageRampSlope,
  buildRoomEdgeWalls,
  buildGappedWallAlongAxis,
  buildSunkenCanyonPassage,
  PARAPET_WALL_HEIGHT,
  SUNKEN_CANYON,
  MIN_CANYON_AREA,
  DEFAULT_ROOM_FOOTPRINT_AREA,
  buildAdjacencyMap,
  bfsDistances,
  findFarthestRoom,
  assignRoomRoles,
  roomsByRole,
  roomsByBand,
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
  PASSAGE_WIDTH
};
