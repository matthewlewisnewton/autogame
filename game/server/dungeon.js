// ── Floor Height Sampling (imported from shared module) ──

const { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } = require('../shared/floorSampling.js');

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

// Hub ship-interior: three zone rooms (Operations, Commerce, Salon) in a compact row.
const HUB_ROOM_WIDTH = 12;
const HUB_ROOM_DEPTH = 12;
const HUB_CELL_SPACING = 20;
const HUB_ANCHOR_INSET = 4; // booth offset from room centre (≥ 1 unit inside edges)

const HUB = {
  roomWidth: HUB_ROOM_WIDTH,
  roomDepth: HUB_ROOM_DEPTH,
  cellSpacing: HUB_CELL_SPACING,
  passageWidth: PASSAGE_WIDTH,
  anchorInset: HUB_ANCHOR_INSET,
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
  // Sunken-canyon is handled by generateSunkenCanyon() — see that branch.
  'sunken-canyon': {
    ...DEFAULT_LAYOUT_PROFILE,
    cellSpacing: OPEN_PLAZA.size,
  },
  // Spire-ascent is handled by generateSpireAscent() — see that branch.
  'spire-ascent': {
    ...DEFAULT_LAYOUT_PROFILE,
    cellSpacing: OPEN_PLAZA.size,
  },
  // Hub ship-interior is handled by generateHub() — see that branch.
  hub: {
    ...DEFAULT_LAYOUT_PROFILE,
    cellSpacing: HUB_CELL_SPACING,
  },
};

// Sunken-canyon stage tuning. Plateau (north / high Y) overlooks a large canyon
// floor (south / low Y) connected by 2–3 sloped ramp rooms.
const SUNKEN_CANYON = {
  plateauSize: 13,
  canyonSize: OPEN_PLAZA.size, // 32 × 32 ⇒ ≥ 4× default room area
  rampWidth: 6,
  rampDepth: 24,
  yDrop: 10,                  // plateau Y − canyon Y (≥ 8 required)
  spawnClearRadius: 6,
  interiorMargin: OPEN_PLAZA.interiorMargin,
  rampXOffsets: [-6, 0, 6], // west / centre / east; width 6 ⇒ footprints [-9,-3], [-3,3], [3,9]
  // Lateral edge connectors (always placed): centre X aligns with canyon-edge probe
  // (±(canyonHalf − 2)) so north-wall gaps and ramp floors reach the perimeter.
  edgeProbeInset: 2,
};

// Spire-ascent: vertical tower of 3–5 flat tiers linked by ascending ramps along −Z.
const SPIRE_ASCENT = {
  tierMinSize: 12,
  tierMaxSize: 15,
  tierXStep: 4,
  rampWidth: 4,
  rampDepth: 8,
  minTotalRise: 10,
  minRampSlope: 0.2,
  edgeHazardStripWidth: 1.2,
  edgeHazardEndPadding: 0.5,
};

function normalizeLayoutProfile(profile) {
  if (typeof profile === 'string') {
    return { ...DEFAULT_LAYOUT_PROFILE, ...(LAYOUT_PROFILES[profile] || LAYOUT_PROFILES.crowded) };
  }
  return { ...DEFAULT_LAYOUT_PROFILE, ...(profile || {}) };
}

function questLayoutSeed(questId, tier = 1) {
  const seedKey = `${questId}:t${tier}`;
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) | 0;
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
  // Open-plaza is a bespoke single-arena layout, not a grid of rooms/passages.
  if (profile === 'open-plaza') {
    return generateOpenPlaza(seed);
  }
  if (profile === 'sunken-canyon') {
    return generateSunkenCanyon(seed);
  }
  if (profile === 'spire-ascent') {
    return generateSpireAscent(seed);
  }
  if (profile === 'hub') {
    return generateHub(seed);
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
 * centred on plaza origin (0, 0).
 */
function overlapsSpawnClear(piece, radius) {
  return overlapsSpawnClearAt(piece, radius, 0, 0);
}

/**
 * Grid flood-fill from an arena centre over the interior, treating any cell
 * whose centre falls inside a cover footprint as blocked. Returns true only
 * when every open interior cell is reachable from the centre.
 */
function arenaFullyReachable(cover, half, centerX = 0, centerZ = 0) {
  const step = 0.5;
  const cells = Math.floor((half * 2) / step);
  const cellX = i => centerX - half + (i + 0.5) * step;
  const cellZ = j => centerZ - half + (j + 0.5) * step;
  const isBlocked = (x, z) =>
    cover.some(c =>
      x >= c.x - c.width / 2 && x <= c.x + c.width / 2 &&
      z >= c.z - c.depth / 2 && z <= c.z + c.depth / 2
    );

  const startI = Math.floor(half / step);
  const startJ = Math.floor(half / step);
  if (isBlocked(cellX(startI), cellZ(startJ))) return false;

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
      if (isBlocked(cellX(ni), cellZ(nj))) continue;
      seen[idx(ni, nj)] = 1;
      queue.push([ni, nj]);
    }
  }

  let open = 0;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      if (!isBlocked(cellX(i), cellZ(j))) open++;
    }
  }
  return reached === open;
}

/** @deprecated alias — use arenaFullyReachable */
function plazaFullyReachable(cover, half) {
  return arenaFullyReachable(cover, half, 0, 0);
}

/**
 * True when a footprint's AABB intersects the spawn-clear circle centred on
 * (centerX, centerZ).
 */
function overlapsSpawnClearAt(piece, radius, centerX = 0, centerZ = 0) {
  const dx = Math.max(Math.abs(piece.x - centerX) - piece.width / 2, 0);
  const dz = Math.max(Math.abs(piece.z - centerZ) - piece.depth / 2, 0);
  return dx * dx + dz * dz < radius * radius;
}

/**
 * Greedily scatter cover pieces inside a square arena. Candidates are shuffled
 * with `rng`, then accepted only when they stay inside the interior margin,
 * clear the spawn zone, avoid overlap, and preserve full interior reachability.
 *
 * @returns {object[]} placed cover pieces (includes any `initialCover`)
 */
function scatterCoverInArena(rng, {
  half,
  centerX = 0,
  centerZ = 0,
  spawnClear,
  candidatePool,
  initialCover = [],
  targetCount = 8,
  interiorMargin = OPEN_PLAZA.interiorMargin,
}) {
  const cover = initialCover.map(c => ({ ...c }));
  const interiorMax = half - interiorMargin;
  const shuffled = candidatePool.map(c => ({ ...c }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (const cand of shuffled) {
    if (cover.length >= targetCount) break;
    if (Math.abs(cand.x - centerX) + cand.width / 2 > interiorMax) continue;
    if (Math.abs(cand.z - centerZ) + cand.depth / 2 > interiorMax) continue;
    if (overlapsSpawnClearAt(cand, spawnClear, centerX, centerZ)) continue;
    if (cover.some(c => footprintsOverlap(cand, c, 0.5))) continue;
    if (!arenaFullyReachable([...cover, cand], half, centerX, centerZ)) continue;
    cover.push({ ...cand });
  }
  return cover;
}

/**
 * Build wall segments along a horizontal (axis 'x') edge, leaving open gaps at
 * the given centre positions.
 */
function buildHorizontalWallWithGaps(z, roomX, totalLength, gapCenters, gapWidth) {
  const walls = [];
  const leftEdge = roomX - totalLength / 2;
  const rightEdge = roomX + totalLength / 2;
  const gaps = gapCenters
    .map(cx => ({ left: cx - gapWidth / 2, right: cx + gapWidth / 2 }))
    .sort((a, b) => a.left - b.left);

  let cursor = leftEdge;
  for (const gap of gaps) {
    if (gap.left > cursor + 0.01) {
      const segLen = gap.left - cursor;
      walls.push({ x: cursor + segLen / 2, z, length: segLen, axis: 'x' });
    }
    cursor = Math.max(cursor, gap.right);
  }
  if (cursor < rightEdge - 0.01) {
    const segLen = rightEdge - cursor;
    walls.push({ x: cursor + segLen / 2, z, length: segLen, axis: 'x' });
  }
  return walls;
}

/**
 * Build a sloped ramp room bridging two elevation bands along one axis.
 * Exported for reuse by spire-ascent work (ticket 136).
 *
 * @param {object} opts
 * @param {number} opts.x - room centre X
 * @param {number} opts.z - room centre Z
 * @param {number} opts.width - room width (X extent)
 * @param {number} opts.depth - room depth (Z extent)
 * @param {number} opts.yHigh - floor Y at the high edge
 * @param {number} opts.yLow - floor Y at the low edge
 * @param {'x'|'z'} opts.axis - 'z': high Y at north (−Z), low at south (+Z);
 *   'x': high at west (−X), low at east (+X)
 * @param {boolean} [opts.openWest] - omit west side wall (axis 'z' only)
 * @param {boolean} [opts.openEast] - omit east side wall (axis 'z' only)
 * @returns {object} room with floorCorners, side walls, band 'ramp'
 */
function buildDescentRampRoom({ x, z, width, depth, yHigh, yLow, axis, openWest = false, openEast = false }) {
  const halfW = width / 2;
  const halfD = depth / 2;
  let floorCorners;
  const walls = [];

  if (axis === 'z') {
    floorCorners = { yNW: yHigh, yNE: yHigh, ySE: yLow, ySW: yLow };
    if (!openWest) walls.push({ x: x - halfW, z, length: depth, axis: 'z' });
    if (!openEast) walls.push({ x: x + halfW, z, length: depth, axis: 'z' });
  } else {
    floorCorners = { yNW: yHigh, yNE: yLow, ySE: yLow, ySW: yHigh };
    walls.push({ x, z: z - halfD, length: width, axis: 'x' });
    walls.push({ x, z: z + halfD, length: width, axis: 'x' });
  }

  return {
    x,
    z,
    width,
    depth,
    walls,
    floorCorners,
    band: 'ramp',
    role: 'connector',
    spawnWeight: 0,
  };
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

  // Candidate scatter positions around the arena. Each is accepted only if it
  // stays inside the interior, clears the spawn zone, doesn't overlap existing
  // cover, and keeps the whole interior reachable (flood-fill).
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

  const allCover = scatterCoverInArena(rng, {
    half,
    spawnClear,
    candidatePool,
    initialCover: cover,
    targetCount: 8,
    interiorMargin: OPEN_PLAZA.interiorMargin,
  });
  cover.length = 0;
  cover.push(...allCover);

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
 * Build the sunken-canyon stage: a high plateau spawn band overlooking a large
 * lower canyon floor, connected by 2–3 sloped ramp rooms. Deterministic for a
 * given seed.
 *
 * Returns { rooms, passages: [], cover, passageWidth, cellSpacing,
 *           profile: 'sunken-canyon' }.
 */
function generateSunkenCanyon(seed) {
  const rng = mulberry32(seed);
  const {
    plateauSize,
    canyonSize,
    rampWidth,
    rampDepth,
    yDrop,
    spawnClearRadius,
    interiorMargin,
    rampXOffsets,
  } = SUNKEN_CANYON;

  const yHigh = DEFAULT_FLOOR_Y + yDrop;
  const yLow = DEFAULT_FLOOR_Y;
  const canyonHalf = canyonSize / 2;
  const plateauHalf = plateauSize / 2;

  // Canyon centred at origin; plateau sits to the north (negative Z).
  const canyonX = 0;
  const canyonZ = 0;
  const canyonNorthZ = canyonZ - canyonHalf;
  const rampZ = canyonNorthZ - rampDepth / 2;
  const rampNorthZ = rampZ - rampDepth / 2;
  const plateauZ = rampNorthZ - plateauHalf;
  const plateauSouthZ = plateauZ + plateauHalf;

  // Pick 2 or 3 central ramp bridges; always add west/east edge connectors (4–5 ramps).
  const numRamps = 2 + Math.floor(rng() * 2);
  const sortedOffsets = [...rampXOffsets].sort((a, b) => a - b);
  const centralRampCenters = numRamps === 2
    ? [sortedOffsets[0], sortedOffsets[sortedOffsets.length - 1]]
    : sortedOffsets;
  const rampHalfW = rampWidth / 2;
  const edgeRampX = canyonHalf - SUNKEN_CANYON.edgeProbeInset - rampHalfW;
  const edgeRampCenters = [-edgeRampX, edgeRampX];
  const rampCenters = [...new Set([...edgeRampCenters, ...centralRampCenters])].sort((a, b) => a - b);
  const rampIntervals = rampCenters.map(cx => ({
    cx,
    minX: cx - rampHalfW,
    maxX: cx + rampHalfW,
  }));

  function isRampEdgeInsideOtherRamp(edgeX, ownCenterX) {
    return rampIntervals.some(
      ({ cx, minX, maxX }) => cx !== ownCenterX && edgeX > minX && edgeX < maxX
    );
  }

  const ramps = rampCenters.map(rampX =>
    buildDescentRampRoom({
      x: rampX,
      z: rampZ,
      width: rampWidth,
      depth: rampDepth,
      yHigh,
      yLow,
      axis: 'z',
      openWest: isRampEdgeInsideOtherRamp(rampX - rampHalfW, rampX),
      openEast: isRampEdgeInsideOtherRamp(rampX + rampHalfW, rampX),
    })
  );

  // Plateau room — flat high band with perimeter walls (south wall has ramp gaps).
  const plateauWalls = [
    { x: 0, z: plateauZ - plateauHalf, length: plateauSize, axis: 'x' }, // north
    { x: -plateauHalf, z: plateauZ, length: plateauSize, axis: 'z' },    // west
    { x: plateauHalf, z: plateauZ, length: plateauSize, axis: 'z' },   // east
    ...buildHorizontalWallWithGaps(plateauSouthZ, 0, plateauSize, rampCenters, rampWidth),
  ];

  const plateau = {
    x: 0,
    z: plateauZ,
    width: plateauSize,
    depth: plateauSize,
    walls: plateauWalls,
    floorCorners: { yNW: yHigh, yNE: yHigh, ySE: yHigh, ySW: yHigh },
    band: 'plateau',
    role: 'start',
    spawnWeight: 0,
    encounterTier: 0,
  };

  // Canyon room — flat low band; north wall has ramp gaps, other edges solid.
  const canyonWalls = [
    ...buildHorizontalWallWithGaps(canyonNorthZ, canyonX, canyonSize, rampCenters, rampWidth),
    { x: canyonX, z: canyonZ + canyonHalf, length: canyonSize, axis: 'x' }, // south
    { x: canyonX - canyonHalf, z: canyonZ, length: canyonSize, axis: 'z' }, // west
    { x: canyonX + canyonHalf, z: canyonZ, length: canyonSize, axis: 'z' }, // east
  ];

  const canyon = {
    x: canyonX,
    z: canyonZ,
    width: canyonSize,
    depth: canyonSize,
    walls: canyonWalls,
    floorCorners: { yNW: yLow, yNE: yLow, ySE: yLow, ySW: yLow },
    band: 'canyon',
    role: 'treasure',
    spawnWeight: 2,
    encounterTier: 0,
  };

  // Cover scatter on the canyon floor (same rules as open-plaza).
  const canyonCandidatePool = [
    { x: 0, z: -11, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 0, z: 11, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: -11, z: 0, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 11, z: 0, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 9, z: -9, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: -9, z: 9, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: -11, z: -11, width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
    { x: 11, z: 11, width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
  ];

  const cover = scatterCoverInArena(rng, {
    half: canyonHalf,
    centerX: canyonX,
    centerZ: canyonZ,
    spawnClear: spawnClearRadius,
    candidatePool: canyonCandidatePool,
    targetCount: 8,
    interiorMargin,
  });

  return {
    rooms: [plateau, ...ramps, canyon],
    passages: [],
    cover,
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: canyonSize,
    profile: 'sunken-canyon',
  };
}

// ── Spire Ascent Stage Generation ──

/**
 * Signed lateral offset for a spire-ascent tier: 0, +step, −2·step, +3·step, …
 */
function spireTierXOffset(tierIndex, tierXStep) {
  if (tierIndex === 0) return 0;
  const sign = tierIndex % 2 === 1 ? 1 : -1;
  return sign * tierIndex * tierXStep;
}

/**
 * Build perimeter walls for a flat tier platform. North/south edges may leave
 * ramp-width gaps centred on the ramp mouth X for each connecting ramp.
 */
function buildTierPerimeterWalls(tierX, tierZ, tierW, tierD, {
  northGap,
  southGap,
  northGapX,
  southGapX,
  northGapWidth,
  southGapWidth,
}) {
  const halfW = tierW / 2;
  const halfD = tierD / 2;
  const northZ = tierZ - halfD;
  const southZ = tierZ + halfD;
  const walls = [
    { x: tierX - halfW, z: tierZ, length: tierD, axis: 'z' },
    { x: tierX + halfW, z: tierZ, length: tierD, axis: 'z' },
  ];

  if (northGap) {
    walls.push(...buildHorizontalWallWithGaps(northZ, tierX, tierW, [northGapX], northGapWidth));
  } else {
    walls.push({ x: tierX, z: northZ, length: tierW, axis: 'x' });
  }

  if (southGap) {
    walls.push(...buildHorizontalWallWithGaps(southZ, tierX, tierW, [southGapX], southGapWidth));
  } else {
    walls.push({ x: tierX, z: southZ, length: tierW, axis: 'x' });
  }

  return walls;
}

/**
 * Thin hazard strips on the outward lateral lip of each combat tier (zig-zag
 * exposes east on odd tierIndex, west on even). Start/treasure tiers omitted.
 */
function buildSpireEdgeHazards(tiers) {
  const { edgeHazardStripWidth, edgeHazardEndPadding } = SPIRE_ASCENT;
  const edgeHazards = [];

  for (const tier of tiers) {
    if (tier.role !== 'combat') continue;

    const halfW = tier.width / 2;
    const halfD = tier.depth / 2;
    const y = tier.floorCorners.yNW;
    const outwardEast = tier.tierIndex % 2 === 1;
    let minX;
    let maxX;

    if (outwardEast) {
      minX = tier.x + halfW - edgeHazardStripWidth;
      maxX = tier.x + halfW;
    } else {
      minX = tier.x - halfW;
      maxX = tier.x - halfW + edgeHazardStripWidth;
    }

    edgeHazards.push({
      tierIndex: tier.tierIndex,
      minX,
      maxX,
      minZ: tier.z - halfD + edgeHazardEndPadding,
      maxZ: tier.z + halfD - edgeHazardEndPadding,
      y,
      side: outwardEast ? 'east' : 'west',
    });
  }

  return edgeHazards;
}

/**
 * Build the spire-ascent stage: 3–5 flat tier platforms along −Z, each step
 * linked by one sloped ramp room. Bottom tier (high +Z) is start; top tier
 * (low −Z) is treasure.
 *
 * Returns { rooms, passages: [], passageWidth, cellSpacing, profile: 'spire-ascent' }.
 */
function generateSpireAscent(seed) {
  const rng = mulberry32(seed);
  const {
    tierMinSize,
    tierMaxSize,
    tierXStep,
    rampWidth,
    rampDepth,
    minTotalRise,
    minRampSlope,
  } = SPIRE_ASCENT;

  const tierCount = 3 + Math.floor(rng() * 3);
  const yStep = minTotalRise / (tierCount - 1);
  if (yStep / rampDepth < minRampSlope) {
    throw new Error('SPIRE_ASCENT rampDepth too large for minRampSlope');
  }

  const tierSpan = tierMaxSize - tierMinSize + 1;
  const tierWidth = tierMinSize + Math.floor(rng() * tierSpan);
  const tierDepth = tierMinSize + Math.floor(rng() * tierSpan);
  const halfTierD = tierDepth / 2;
  const halfRampD = rampDepth / 2;

  const step = tierDepth + rampDepth;
  const totalSpan = (tierCount - 1) * step + tierDepth;
  const bottomTierZ = totalSpan / 2 - halfTierD;

  const tierXs = Array.from({ length: tierCount }, (_, i) => spireTierXOffset(i, tierXStep));
  const rampWidths = [];
  for (let i = 0; i < tierCount - 1; i++) {
    const lateralSpan = Math.abs(tierXs[i + 1] - tierXs[i]);
    rampWidths.push(Math.max(rampWidth, lateralSpan + rampWidth));
  }

  const tiers = [];
  const ramps = [];

  for (let i = 0; i < tierCount; i++) {
    const tierX = tierXs[i];
    const tierZ = bottomTierZ - i * step;
    const y = DEFAULT_FLOOR_Y + i * yStep;
    const isBottom = i === 0;
    const isTop = i === tierCount - 1;

    const northGapX = isTop ? tierX : (tierX + tierXs[i + 1]) / 2;
    const southGapX = isBottom ? tierX : (tierXs[i - 1] + tierX) / 2;
    const northGapWidth = isTop ? rampWidth : rampWidths[i];
    const southGapWidth = isBottom ? rampWidth : rampWidths[i - 1];

    let role;
    let spawnWeight;
    if (isBottom) {
      role = 'start';
      spawnWeight = 0;
    } else if (isTop) {
      role = 'treasure';
      spawnWeight = 2;
    } else {
      role = 'combat';
      spawnWeight = 1;
    }

    tiers.push({
      x: tierX,
      z: tierZ,
      width: tierWidth,
      depth: tierDepth,
      walls: buildTierPerimeterWalls(tierX, tierZ, tierWidth, tierDepth, {
        northGap: !isTop,
        southGap: !isBottom,
        northGapX,
        southGapX,
        northGapWidth,
        southGapWidth,
      }),
      floorCorners: { yNW: y, yNE: y, ySE: y, ySW: y },
      band: 'tier',
      tierIndex: i,
      tierXOffset: tierX,
      role,
      spawnWeight,
      encounterTier: i,
    });

    if (i < tierCount - 1) {
      const yHigh = DEFAULT_FLOOR_Y + (i + 1) * yStep;
      const yLow = DEFAULT_FLOOR_Y + i * yStep;
      const tierNorthZ = tierZ - halfTierD;
      const rampZ = tierNorthZ - halfRampD;
      const rampCenterX = (tierX + tierXs[i + 1]) / 2;
      ramps.push(
        buildDescentRampRoom({
          x: rampCenterX,
          z: rampZ,
          width: rampWidths[i],
          depth: rampDepth,
          yHigh,
          yLow,
          axis: 'z',
        })
      );
    }
  }

  const rooms = [];
  for (let i = 0; i < tierCount; i++) {
    rooms.push(tiers[i]);
    if (i < ramps.length) rooms.push(ramps[i]);
  }

  const edgeHazards = buildSpireEdgeHazards(tiers);

  return {
    rooms,
    passages: [],
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: Math.max(tierWidth, totalSpan),
    profile: 'spire-ascent',
    edgeHazards,
  };
}

// ── Hub Ship-Interior Stage Generation ──

/**
 * Build perimeter walls for a hub zone room. Passage gaps are only on sides
 * listed in `gapSides` ('north' | 'south' | 'east' | 'west').
 */
function buildHubRoomWalls(x, z, width, depth, gapSides, passageWidth) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const gap = passageWidth;
  const walls = [];

  // North wall (z = z - halfD), along x-axis
  if (!gapSides.has('north')) {
    walls.push({ x, z: z - halfD, length: width, axis: 'x' });
  } else {
    const segLen = (width - gap) / 2;
    walls.push({ x: x - gap / 2 - segLen / 2, z: z - halfD, length: segLen, axis: 'x' });
    walls.push({ x: x + gap / 2 + segLen / 2, z: z - halfD, length: segLen, axis: 'x' });
  }

  // South wall (z = z + halfD)
  if (!gapSides.has('south')) {
    walls.push({ x, z: z + halfD, length: width, axis: 'x' });
  } else {
    const segLen = (width - gap) / 2;
    walls.push({ x: x - gap / 2 - segLen / 2, z: z + halfD, length: segLen, axis: 'x' });
    walls.push({ x: x + gap / 2 + segLen / 2, z: z + halfD, length: segLen, axis: 'x' });
  }

  // West wall (x = x - halfW), along z-axis
  if (!gapSides.has('west')) {
    walls.push({ x: x - halfW, z, length: depth, axis: 'z' });
  } else {
    const segLen = (depth - gap) / 2;
    walls.push({ x: x - halfW, z: z - gap / 2 - segLen / 2, length: segLen, axis: 'z' });
    walls.push({ x: x - halfW, z: z + gap / 2 + segLen / 2, length: segLen, axis: 'z' });
  }

  // East wall (x = x + halfW)
  if (!gapSides.has('east')) {
    walls.push({ x: x + halfW, z, length: depth, axis: 'z' });
  } else {
    const segLen = (depth - gap) / 2;
    walls.push({ x: x + halfW, z: z - gap / 2 - segLen / 2, length: segLen, axis: 'z' });
    walls.push({ x: x + halfW, z: z + gap / 2 + segLen / 2, length: segLen, axis: 'z' });
  }

  return walls;
}

/**
 * Build a horizontal corridor passage between two rooms on the same Z row.
 */
function buildHubHorizontalPassage(fromX, fromZ, toX, toZ, fromRoom, toRoom, passageWidth) {
  const halfGap = passageWidth / 2;
  const corridorLength = HUB.cellSpacing - fromRoom.width / 2 - toRoom.width / 2;
  const wallCentreX = (fromX + toX) / 2;
  const walls = [
    { x: wallCentreX, z: fromZ - halfGap, length: corridorLength, axis: 'x' },
    { x: wallCentreX, z: fromZ + halfGap, length: corridorLength, axis: 'x' },
  ];
  return { x1: fromX, z1: fromZ, x2: toX, z2: toZ, walls, corridorLength };
}

/**
 * Build the hub ship-interior: three connected zone rooms (Operations west,
 * Commerce centre, Salon east) with booth anchor positions. Deterministic for
 * a given seed (layout is hand-placed; seed is accepted for API consistency).
 *
 * Returns { rooms, passages, boothAnchors, passageWidth, cellSpacing,
 *           profile: 'hub' }.
 */
function generateHub(seed) {
  const { roomWidth, roomDepth, cellSpacing, passageWidth, anchorInset } = HUB;
  const halfSpacing = cellSpacing;

  // West → centre → east along +X
  const operationsX = -halfSpacing;
  const commerceX = 0;
  const salonX = halfSpacing;
  const rowZ = 0;

  const flatFloor = {
    yNW: DEFAULT_FLOOR_Y,
    yNE: DEFAULT_FLOOR_Y,
    ySE: DEFAULT_FLOOR_Y,
    ySW: DEFAULT_FLOOR_Y,
  };

  const operations = {
    x: operationsX,
    z: rowZ,
    width: roomWidth,
    depth: roomDepth,
    walls: buildHubRoomWalls(operationsX, rowZ, roomWidth, roomDepth, new Set(['east']), passageWidth),
    floorCorners: { ...flatFloor },
    hubZone: 'operations',
    role: 'start',
    spawnWeight: 0,
  };

  const commerce = {
    x: commerceX,
    z: rowZ,
    width: roomWidth,
    depth: roomDepth,
    walls: buildHubRoomWalls(commerceX, rowZ, roomWidth, roomDepth, new Set(['west', 'east']), passageWidth),
    floorCorners: { ...flatFloor },
    hubZone: 'commerce',
    role: 'connector',
    spawnWeight: 0,
  };

  const salon = {
    x: salonX,
    z: rowZ,
    width: roomWidth,
    depth: roomDepth,
    walls: buildHubRoomWalls(salonX, rowZ, roomWidth, roomDepth, new Set(['west']), passageWidth),
    floorCorners: { ...flatFloor },
    hubZone: 'salon',
    role: 'connector',
    spawnWeight: 0,
  };

  const rooms = [operations, commerce, salon];

  const passages = [
    buildHubHorizontalPassage(operationsX, rowZ, commerceX, rowZ, operations, commerce, passageWidth),
    buildHubHorizontalPassage(commerceX, rowZ, salonX, rowZ, commerce, salon, passageWidth),
  ];

  const boothAnchors = {
    quest: { x: operationsX - anchorInset, z: rowZ - anchorInset },
    launch: { x: operationsX + anchorInset, z: rowZ + anchorInset },
    shop: { x: commerceX - anchorInset, z: rowZ - anchorInset },
    deck: { x: commerceX + anchorInset, z: rowZ + anchorInset },
    character: { x: salonX - anchorInset, z: rowZ - anchorInset },
    hats: { x: salonX + anchorInset, z: rowZ + anchorInset },
  };

  return {
    rooms,
    passages,
    boothAnchors,
    passageWidth,
    cellSpacing,
    profile: 'hub',
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
 * For the single-room open-plaza layout no room has role 'combat'/'treasure',
 * so this returns [] for those roles and callers (randomRoomPositionByRole)
 * fall back to the plaza, placing enemies/objectives across the open floor.
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
  generateSunkenCanyon,
  generateSpireAscent,
  buildSpireEdgeHazards,
  generateHub,
  buildDescentRampRoom,
  scatterCoverInArena,
  buildAdjacencyMap,
  bfsDistances,
  findFarthestRoom,
  assignRoomRoles,
  roomsByRole,
  randomRoomPositionByRole,
  sampleFloorY,
  resolveFloorY,
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
  HUB,
};
