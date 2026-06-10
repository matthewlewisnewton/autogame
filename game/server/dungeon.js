// ── Floor Height Sampling (imported from shared module) ──

const { sampleFloorY, sampleFloorSurface, DEFAULT_FLOOR_Y, resolveFloorY } = require('../shared/floorSampling.js');

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

// Boss-arena tuning: one compact single-room layout for dedicated boss-level quests.
const BOSS_ARENA = {
  size: 24,                 // smaller than open-plaza — tight duel floor
  spawnClearRadius: 5,      // keep cover out of the arena_dais spawn circle
  interiorMargin: 2,
  coverTargetCount: 3,      // sparse cover (open-plaza targets 8)
};

// Rift arena theme (arenaTheme: 'rift'): cosmetic floor-band decals only.
const RIFT_THEME = {
  bandInnerX: 4,            // band inner edge — clear of the center_ring (outerRadius 3.2)
  bandWallInset: 0.6,       // keep decals fully inside the arena walls
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
  default: {
    ...DEFAULT_LAYOUT_PROFILE,
  },
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
  // Boss-arena is handled by generateBossArena() — see that branch.
  'boss-arena': {
    ...DEFAULT_LAYOUT_PROFILE,
    cellSpacing: BOSS_ARENA.size,
  },
  // Sunken-canyon is handled by generateSunkenCanyon() — see that branch.
  'sunken-canyon': {
    ...DEFAULT_LAYOUT_PROFILE,
    cellSpacing: OPEN_PLAZA.size,
  },
  // Ice-cavern is handled by generateIceCavern() — see that branch.
  'ice-cavern': {
    ...DEFAULT_LAYOUT_PROFILE,
    cellSpacing: OPEN_PLAZA.size,
  },
  // Fire-cavern is handled by generateFireCavern() — see that branch.
  'fire-cavern': {
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

/** Fixed grid geometry for `layoutMode: 'rigid'` on crowded/open profiles. */
const GRID_RIGID = {
  crowded: {
    startR: 1,
    startC: 1,
    roomWidth: 13,
    roomDepth: 13,
    coverPerCombatRoom: 2,
    landmarkCount: 1,
    rampCount: 1,
    rampRoomIndices: [2],
  },
  open: {
    startR: 1,
    startC: 1,
    roomWidth: 21,
    roomDepth: 21,
    platformCount: 1,
    hazardCount: 1,
    coverGoal: 1,
    landmarkCount: 1,
    rampCount: 2,
    rampRoomIndices: [2, 3],
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
  // Emissive lip strips at plateau south edge (one per ramp mouth); visual only.
  cliffLipStripDepth: 1.2,
  cliffLipPlateauInset: 0.35,
  // Narrow hazard strips along the plateau south rim between ramp mouths.
  cliffHazardStripDepth: 1.2,
  cliffHazardEndPadding: 0.35,
  /** Fixed geometry for `layoutMode: 'rigid'` — seed-independent. */
  rigidCentralRampCount: 3,
  /** Normalized interior offsets (−1…1) for rigid monolith placement. */
  rigidMonolithOffsetX: 0.3,
  rigidMonolithOffsetZ: -0.5,
  rigidMonolithYaw: 0,
};

// Ice-cavern: stone entry dock, large slippery ice sheet, stone treasure pad.
const ICE_CAVERN = {
  stonePadSize: 13,
  iceSize: OPEN_PLAZA.size, // 32 × 32 ⇒ ≥ 4× default room area
  rampWidth: 6,
  rampDepth: 10,
  spawnClearRadius: 6,
  interiorMargin: OPEN_PLAZA.interiorMargin,
  rampXOffsets: [-3, 0, 3], // centres must stay inside stonePadSize with rampWidth
  treasureGapWidth: 8,
  /** Fixed geometry for `layoutMode: 'rigid'` — seed-independent. */
  rigidRampCount: 2,
  rigidCoverPerStonePad: 2,
  rigidEntryDecorCount: 2,
  // The 13×13 stone pads cannot fit cover outside the full spawnClearRadius (6)
  // yet inside the interior margin, so rigid pad cover uses a tighter circle.
  rigidPadSpawnClear: 3,
};

// Fire-cavern stage tuning. Rim (north / high Y) overlooks a large volcanic basin
// floor (south / low Y) connected by 2–3 sloped ramp rooms.
const FIRE_CAVERN = {
  rimSize: 13,
  basinSize: OPEN_PLAZA.size, // 32 × 32 ⇒ ≥ 4× default room area
  rampWidth: 6,
  rampDepth: 24,
  yDrop: 10,                  // rim Y − basin Y (≥ 8 required)
  spawnClearRadius: 6,
  interiorMargin: OPEN_PLAZA.interiorMargin,
  rampXOffsets: [-6, 0, 6], // west / centre / east; width 6 ⇒ footprints [-9,-3], [-3,3], [3,9]
  /** Fixed geometry for `layoutMode: 'rigid'` — seed-independent. */
  rigidRampCount: 3,
  rigidCoverTargetCount: 8,
  rigidEntryDecorCount: 3,
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
  /** Fixed geometry for `layoutMode: 'rigid'` — seed-independent. */
  rigidTierCount: 4,
  rigidTierWidth: 14,
  rigidTierDepth: 14,
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

/** @typedef {'default' | 'rigid'} LayoutMode */

/**
 * Normalize layoutMode option; unknown values fall back to 'default'.
 * @param {string|undefined} layoutMode
 * @returns {LayoutMode}
 */
function normalizeLayoutMode(layoutMode) {
  return layoutMode === 'rigid' ? 'rigid' : 'default';
}

/** Deduplicate frontier cells and pick the lowest (row, col) for rigid grid growth. */
function pickRigidFrontierCell(frontier) {
  const seen = new Set();
  const unique = [];
  for (const cell of frontier) {
    const k = `${cell.r},${cell.c}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(cell);
  }
  unique.sort((a, b) => a.r - b.r || a.c - b.c);
  return unique[0];
}

/**
 * Generate a deterministic dungeon layout from a numeric seed.
 * Returns { rooms: [...], passages: [...], passageWidth, profile }
 *
 * @param {number} seed - PRNG seed for deterministic generation
 * @param {string|object} [profile=DEFAULT_LAYOUT_PROFILE] - Layout profile name or object
 * @param {object} [options={}] - Optional flags: { slopes: boolean, layoutMode: LayoutMode }
 */
function generateLayout(seed, profile = DEFAULT_LAYOUT_PROFILE, options = {}) {
  // Open-plaza is a bespoke single-arena layout, not a grid of rooms/passages.
  if (profile === 'open-plaza') {
    return generateOpenPlaza(seed, options);
  }
  if (profile === 'boss-arena') {
    return generateBossArena(seed, options);
  }
  if (profile === 'sunken-canyon') {
    return generateSunkenCanyon(seed, options);
  }
  if (profile === 'ice-cavern') {
    return generateIceCavern(seed, options);
  }
  if (profile === 'fire-cavern') {
    return generateFireCavern(seed, options);
  }
  if (profile === 'spire-ascent') {
    return generateSpireAscent(seed, options);
  }
  if (profile === 'hub') {
    return generateHub(seed);
  }

  const opts = normalizeLayoutProfile(profile);
  const layoutMode = normalizeLayoutMode(options.layoutMode);
  const profileName = typeof profile === 'string' && LAYOUT_PROFILES[profile]
    ? profile
    : 'default';
  const rigidGrid = layoutMode === 'rigid' ? GRID_RIGID[profileName] : null;
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

  const startR = rigidGrid ? rigidGrid.startR : Math.floor(rng() * gridRows);
  const startC = rigidGrid ? rigidGrid.startC : Math.floor(rng() * gridCols);
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

    // Pick a frontier cell (deterministic first-in-sort for rigid mode)
    const pick = rigidGrid
      ? pickRigidFrontierCell(frontier)
      : frontier[Math.floor(rng() * frontier.length)];
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

  // Pick a starting cell for the spanning tree (index 0 in rigid mode)
  const startIdx = rigidGrid ? 0 : Math.floor(rng() * cellPositions.length);
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
      // Pick an unvisited neighbor (lowest index in rigid mode)
      const nextIdx = rigidGrid
        ? neighbors.sort((a, b) => a - b)[0]
        : neighbors[Math.floor(rng() * neighbors.length)];
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
  // Shuffle and pick a fraction (rigid mode skips extra loop edges)
  if (!rigidGrid) {
    for (let i = possibleExtra.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [possibleExtra[i], possibleExtra[j]] = [possibleExtra[j], possibleExtra[i]];
    }
  }
  const extraEdgeFraction = rigidGrid ? 0 : opts.extraEdgeFraction;
  const extraCount = Math.min(Math.floor(possibleExtra.length * extraEdgeFraction), possibleExtra.length);
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
    const width = rigidGrid
      ? rigidGrid.roomWidth
      : minRoomSize + Math.floor(rng() * (maxRoomSize - minRoomSize + 1));
    const depth = rigidGrid
      ? rigidGrid.roomDepth
      : minRoomSize + Math.floor(rng() * (maxRoomSize - minRoomSize + 1));
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
    let rampIndices;
    if (rigidGrid) {
      rampIndices = rigidGrid.rampRoomIndices.filter(i => i > 0 && i < rooms.length);
    } else {
      let numRamps = Math.min(1 + Math.floor(rng() * 2), candidates.length);
      // Open profile biases toward more verticality when the dungeon is large enough.
      if (profile === 'open' && rooms.length > 3) {
        numRamps = Math.min(Math.max(2, numRamps), candidates.length);
      }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      rampIndices = candidates.slice(0, numRamps);
    }
    for (const idx of rampIndices) {
      const room = rooms[idx];
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

  if (profileName === 'crowded') {
    rooms[0].band = 'vault-entry';
  }

  const layout = {
    rooms,
    passages: passageObjects,
    passageWidth,
    cellSpacing,
    profile: profileName,
  };

  if (profile === 'crowded') {
    decorateCrowdedLayout(layout, rng, options);
  }

  if (profile === 'open') {
    decorateOpenLayout(layout, rng, options);
  }

  return layout;
}

// ── Crowded interior cover ──

const CROWDED_COVER_MARGIN = 2;
const CROWDED_DOORWAY_DEPTH = 3;

const CROWDED_COVER_TYPES = [
  { width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
  { width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
  { width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
];

function isRoomSloped(room) {
  const { yNW, yNE, ySE, ySW } = room.floorCorners;
  return yNW !== yNE || yNE !== ySE || ySE !== ySW;
}

/**
 * Derive doorway clear-zone footprints from split wall segments on each edge.
 * Each zone is a { x, z, width, depth } rectangle extending inward from the gap.
 */
function roomDoorwayZones(room, passageWidth) {
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const zones = [];
  const gapW = passageWidth + 0.5;
  const depth = CROWDED_DOORWAY_DEPTH;

  const xWalls = room.walls.filter(w => w.axis === 'x');
  const zWalls = room.walls.filter(w => w.axis === 'z');

  const northZ = room.z - halfD;
  const southZ = room.z + halfD;
  const westX = room.x - halfW;
  const eastX = room.x + halfW;

  const hasGapOnEdge = (walls, coordKey, edgeVal) =>
    walls.filter(w => Math.abs(w[coordKey] - edgeVal) < 0.01).length >= 2;

  if (hasGapOnEdge(xWalls, 'z', northZ)) {
    zones.push({ x: room.x, z: northZ + depth / 2, width: gapW, depth });
  }
  if (hasGapOnEdge(xWalls, 'z', southZ)) {
    zones.push({ x: room.x, z: southZ - depth / 2, width: gapW, depth });
  }
  if (hasGapOnEdge(zWalls, 'x', westX)) {
    zones.push({ x: westX + depth / 2, z: room.z, width: depth, depth: gapW });
  }
  if (hasGapOnEdge(zWalls, 'x', eastX)) {
    zones.push({ x: eastX - depth / 2, z: room.z, width: depth, depth: gapW });
  }

  return zones;
}

/**
 * Grid flood-fill from a room centre over the interior, treating cover
 * footprints as blocked. Returns true when every open cell is reachable.
 */
function roomFullyReachable(room, cover, margin = CROWDED_COVER_MARGIN) {
  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  if (halfW <= 0 || halfD <= 0) return cover.length === 0;

  const step = 0.5;
  const cellsX = Math.floor((halfW * 2) / step);
  const cellsZ = Math.floor((halfD * 2) / step);
  const cellX = i => room.x - halfW + (i + 0.5) * step;
  const cellZ = j => room.z - halfD + (j + 0.5) * step;
  const isBlocked = (x, z) =>
    cover.some(c =>
      x >= c.x - c.width / 2 && x <= c.x + c.width / 2 &&
      z >= c.z - c.depth / 2 && z <= c.z + c.depth / 2
    );

  const startI = Math.floor(halfW / step);
  const startJ = Math.floor(halfD / step);
  if (isBlocked(cellX(startI), cellZ(startJ))) return false;

  const seen = new Uint8Array(cellsX * cellsZ);
  const idx = (i, j) => j * cellsX + i;
  const queue = [[startI, startJ]];
  seen[idx(startI, startJ)] = 1;
  let reached = 0;
  while (queue.length > 0) {
    const [i, j] = queue.pop();
    reached++;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || ni >= cellsX || nj < 0 || nj >= cellsZ) continue;
      if (seen[idx(ni, nj)]) continue;
      if (isBlocked(cellX(ni), cellZ(nj))) continue;
      seen[idx(ni, nj)] = 1;
      queue.push([ni, nj]);
    }
  }

  let open = 0;
  for (let j = 0; j < cellsZ; j++) {
    for (let i = 0; i < cellsX; i++) {
      if (!isBlocked(cellX(i), cellZ(j))) open++;
    }
  }
  return reached === open;
}

function acceptsCoverCandidate(cand, room, cover, doorwayZones, margin) {
  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  if (Math.abs(cand.x - room.x) + cand.width / 2 > halfW) return false;
  if (Math.abs(cand.z - room.z) + cand.depth / 2 > halfD) return false;
  if (doorwayZones.some(z => footprintsOverlap(cand, z, 0.25))) return false;
  if (cover.some(c => footprintsOverlap(cand, c, 0.5))) return false;
  if (!roomFullyReachable(room, [...cover, cand], margin)) return false;
  return true;
}

/**
 * Greedily place 1–3 cover candidates inside a combat room AABB, rejecting
 * overlaps, doorway-blocking positions, and layouts that partition the interior.
 */
function scatterCoverInRoom(rng, room, { targetCount = 2, margin = CROWDED_COVER_MARGIN, passageWidth = PASSAGE_WIDTH }) {
  if (isRoomSloped(room)) return [];

  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  if (halfW <= 1 || halfD <= 1) return [];

  const doorwayZones = roomDoorwayZones(room, passageWidth);
  const cover = [];
  const goal = Math.max(1, Math.min(3, targetCount));

  const candidatePool = [];
  const gridSteps = [-0.65, -0.35, 0.35, 0.65];
  for (const tx of gridSteps) {
    for (const tz of gridSteps) {
      const base = CROWDED_COVER_TYPES[Math.floor(rng() * CROWDED_COVER_TYPES.length)];
      candidatePool.push({
        x: room.x + tx * halfW,
        z: room.z + tz * halfD,
        width: base.width,
        depth: base.depth,
        height: base.height,
        type: base.type,
      });
    }
  }
  for (let i = 0; i < 16; i++) {
    const base = CROWDED_COVER_TYPES[Math.floor(rng() * CROWDED_COVER_TYPES.length)];
    candidatePool.push({
      x: room.x + (rng() * 2 - 1) * halfW * 0.85,
      z: room.z + (rng() * 2 - 1) * halfD * 0.85,
      width: base.width,
      depth: base.depth,
      height: base.height,
      type: base.type,
    });
  }

  for (let i = candidatePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
  }

  for (const cand of candidatePool) {
    if (cover.length >= goal) break;
    if (!acceptsCoverCandidate(cand, room, cover, doorwayZones, margin)) continue;
    cover.push({
      x: cand.x, z: cand.z,
      width: cand.width, depth: cand.depth, height: cand.height,
      type: cand.type,
    });
  }

  // Guarantee at least one piece when the room is flat and large enough.
  if (cover.length === 0) {
    const pillar = CROWDED_COVER_TYPES[0];
    const fallbacks = [
      { x: room.x - halfW * 0.55, z: room.z - halfD * 0.55 },
      { x: room.x + halfW * 0.55, z: room.z - halfD * 0.55 },
      { x: room.x - halfW * 0.55, z: room.z + halfD * 0.55 },
      { x: room.x + halfW * 0.55, z: room.z + halfD * 0.55 },
      { x: room.x, z: room.z - halfD * 0.45 },
      { x: room.x, z: room.z + halfD * 0.45 },
    ];
    for (const pos of fallbacks) {
      const cand = { ...pos, ...pillar };
      if (acceptsCoverCandidate(cand, room, cover, doorwayZones, margin)) {
        cover.push(cand);
        break;
      }
    }
  }

  return cover;
}

function buildCrowdedCoverCandidatePool(room, margin = CROWDED_COVER_MARGIN) {
  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  const candidatePool = [];
  const gridSteps = [-0.65, -0.35, 0.35, 0.65];
  for (const base of CROWDED_COVER_TYPES) {
    for (const tx of gridSteps) {
      for (const tz of gridSteps) {
        candidatePool.push({
          x: room.x + tx * halfW,
          z: room.z + tz * halfD,
          width: base.width,
          depth: base.depth,
          height: base.height,
          type: base.type,
        });
      }
    }
  }
  const pillar = CROWDED_COVER_TYPES[0];
  const fallbacks = [
    { x: room.x - halfW * 0.55, z: room.z - halfD * 0.55 },
    { x: room.x + halfW * 0.55, z: room.z - halfD * 0.55 },
    { x: room.x - halfW * 0.55, z: room.z + halfD * 0.55 },
    { x: room.x + halfW * 0.55, z: room.z + halfD * 0.55 },
    { x: room.x, z: room.z - halfD * 0.45 },
    { x: room.x, z: room.z + halfD * 0.45 },
  ];
  for (const pos of fallbacks) {
    candidatePool.push({ ...pos, ...pillar });
  }
  return candidatePool;
}

/**
 * Place cover in declaration order (no RNG shuffle). Used by crowded rigid mode.
 */
function placeCoverInRoomOrdered(room, { targetCount, margin = CROWDED_COVER_MARGIN, passageWidth = PASSAGE_WIDTH }) {
  if (isRoomSloped(room)) return [];

  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  if (halfW <= 1 || halfD <= 1) return [];

  const doorwayZones = roomDoorwayZones(room, passageWidth);
  const cover = [];
  const goal = Math.max(1, Math.min(3, targetCount));
  const candidatePool = buildCrowdedCoverCandidatePool(room, margin);

  for (const cand of candidatePool) {
    if (cover.length >= goal) break;
    if (!acceptsCoverCandidate(cand, room, cover, doorwayZones, margin)) continue;
    cover.push({
      x: cand.x, z: cand.z,
      width: cand.width, depth: cand.depth, height: cand.height,
      type: cand.type,
    });
  }

  return cover;
}

/**
 * Scatter interior cover into every combat room on a crowded grid layout.
 */
function decorateCrowdedLayout(layout, rng, options = {}) {
  const layoutMode = normalizeLayoutMode(options.layoutMode);
  const cover = [];
  const rigid = GRID_RIGID.crowded;

  for (const room of layout.rooms) {
    if (room.role !== 'combat') continue;
    if (layoutMode === 'rigid') {
      cover.push(...placeCoverInRoomOrdered(room, {
        targetCount: rigid.coverPerCombatRoom,
        margin: CROWDED_COVER_MARGIN,
        passageWidth: layout.passageWidth,
      }));
    } else {
      const targetCount = 1 + Math.floor(rng() * 3);
      cover.push(...scatterCoverInRoom(rng, room, {
        targetCount,
        margin: CROWDED_COVER_MARGIN,
        passageWidth: layout.passageWidth,
      }));
    }
  }
  layout.cover = cover;
  layout.landmarks = layoutMode === 'rigid'
    ? (() => {
        const vault = placeVaultDaisRigid(layout);
        return vault ? [vault] : [];
      })()
    : placeLandmarks(layout, rng, 'crowded');

  const startRoom = layout.rooms.find(r => r.role === 'start');
  if (startRoom && !isRoomSloped(startRoom)) {
    const half = Math.min(startRoom.width, startRoom.depth) / 2;
    layout.entryDecor = scatterEntryDecor(rng, {
      half,
      centerX: startRoom.x,
      centerZ: startRoom.z,
      spawnClear: OPEN_PLAZA.spawnClearRadius,
      type: 'vault_rubble',
      count: 2 + Math.floor(rng() * 3),
    });
  } else {
    layout.entryDecor = [];
  }

  return layout;
}

// ── Profile landmark props ──

const LANDMARK_TYPES = {
  crowded: ['reactor_coil', 'pipe_stack'],
  open: ['sand_spire', 'sun_arch'],
};

const LANDMARK_FOOTPRINTS = {
  reactor_coil: { width: 2.4, depth: 2.4 },
  pipe_stack: { width: 2.0, depth: 2.8 },
  sand_spire: { width: 2.2, depth: 2.2 },
  sun_arch: { width: 3.2, depth: 1.6 },
  canyon_monolith: { width: 2.0, depth: 2.0 },
  vault_dais: { width: 2.4, depth: 2.4 },
  ice_cairn: { width: 2.0, depth: 2.0 },
};

const LANDMARK_MARGIN = 2.5;

function landmarkFootprint(type, x, z) {
  const fp = LANDMARK_FOOTPRINTS[type];
  return { x, z, width: fp.width, depth: fp.depth };
}

function acceptsLandmarkCandidate(cand, room, blocked, doorwayZones, margin = LANDMARK_MARGIN) {
  const fp = landmarkFootprint(cand.type, cand.x, cand.z);
  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  if (halfW <= 0 || halfD <= 0) return false;
  if (Math.abs(fp.x - room.x) + fp.width / 2 > halfW) return false;
  if (Math.abs(fp.z - room.z) + fp.depth / 2 > halfD) return false;
  if (doorwayZones.some(z => footprintsOverlap(fp, z, 0.25))) return false;
  if (blocked.some(b => footprintsOverlap(fp, b, 0.5))) return false;
  return true;
}

function tryPlaceLandmarkInRoom(rng, room, type, layout, blocked, existingLandmarks) {
  const doorwayZones = roomDoorwayZones(room, layout.passageWidth);
  const margin = LANDMARK_MARGIN;
  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  if (halfW <= 0 || halfD <= 0) return null;

  const allBlocked = [...blocked, ...existingLandmarks.map(lm => landmarkFootprint(lm.type, lm.x, lm.z))];
  const gridSteps = [-0.6, -0.3, 0.3, 0.6];
  const candidates = [];
  for (const tx of gridSteps) {
    for (const tz of gridSteps) {
      candidates.push({
        x: room.x + tx * halfW,
        z: room.z + tz * halfD,
        type,
        yaw: Math.floor(rng() * 4) * (Math.PI / 2),
      });
    }
  }
  for (let i = 0; i < 12; i++) {
    candidates.push({
      x: room.x + (rng() * 2 - 1) * halfW * 0.8,
      z: room.z + (rng() * 2 - 1) * halfD * 0.8,
      type,
      yaw: rng() * Math.PI * 2,
    });
  }
  shuffleInPlace(candidates, rng);

  for (const cand of candidates) {
    if (!acceptsLandmarkCandidate(cand, room, allBlocked, doorwayZones, margin)) continue;
    return cand;
  }
  return null;
}

/**
 * Place 1–2 deterministic landmark props in non-start rooms (combat/treasure preferred).
 */
function placeLandmarks(layout, rng, profile) {
  const types = LANDMARK_TYPES[profile];
  if (!types) return [];

  const hostRooms = layout.rooms.filter(r => r.role !== 'start' && !isRoomSloped(r));
  const preferred = hostRooms.filter(r => r.role === 'combat' || r.role === 'treasure');
  const pool = preferred.length > 0 ? preferred : hostRooms;
  if (pool.length === 0) return [];

  const blocked = [
    ...(layout.cover || []),
    ...(layout.platforms || []),
    ...(layout.hazards || []),
  ];

  const shuffled = [...pool];
  shuffleInPlace(shuffled, rng);
  const goal = Math.min(1 + Math.floor(rng() * 2), shuffled.length);

  const landmarks = [];
  for (let i = 0; i < goal; i++) {
    const room = shuffled[i];
    const type = types[Math.floor(rng() * types.length)];
    const placed = tryPlaceLandmarkInRoom(rng, room, type, layout, blocked, landmarks);
    if (placed) {
      landmarks.push(placed);
      blocked.push(landmarkFootprint(placed.type, placed.x, placed.z));
    }
  }

  if (landmarks.length === 0) {
    for (const room of shuffled) {
      for (const type of types) {
        const placed = tryPlaceLandmarkInRoom(rng, room, type, layout, blocked, landmarks);
        if (placed) {
          landmarks.push(placed);
          break;
        }
      }
      if (landmarks.length > 0) break;
    }
  }

  return landmarks;
}

function tryPlaceLandmarkInRoomOrdered(room, type, layout, blocked, existingLandmarks) {
  const doorwayZones = roomDoorwayZones(room, layout.passageWidth);
  const margin = LANDMARK_MARGIN;
  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  if (halfW <= 0 || halfD <= 0) return null;

  const allBlocked = [...blocked, ...existingLandmarks.map(lm => landmarkFootprint(lm.type, lm.x, lm.z))];
  const gridSteps = [-0.6, -0.3, 0.3, 0.6];
  const candidates = [];
  for (const tx of gridSteps) {
    for (const tz of gridSteps) {
      candidates.push({
        x: room.x + tx * halfW,
        z: room.z + tz * halfD,
        type,
        yaw: 0,
      });
    }
  }

  for (const cand of candidates) {
    if (!acceptsLandmarkCandidate(cand, room, allBlocked, doorwayZones, margin)) continue;
    return cand;
  }
  return null;
}

/**
 * Place landmarks in sorted room order with the first allowed type (rigid mode).
 */
function placeLandmarksOrdered(layout, profile, goal = 1) {
  const types = LANDMARK_TYPES[profile];
  if (!types) return [];

  const hostRooms = layout.rooms.filter(r => r.role !== 'start' && !isRoomSloped(r));
  const preferred = hostRooms.filter(r => r.role === 'combat' || r.role === 'treasure');
  const pool = (preferred.length > 0 ? preferred : hostRooms)
    .sort((a, b) => a.x - b.x || a.z - b.z);
  if (pool.length === 0) return [];

  const blocked = [
    ...(layout.cover || []),
    ...(layout.platforms || []),
    ...(layout.hazards || []),
  ];

  const landmarks = [];
  const type = types[0];
  for (let i = 0; i < Math.min(goal, pool.length); i++) {
    const room = pool[i];
    const placed = tryPlaceLandmarkInRoomOrdered(room, type, layout, blocked, landmarks);
    if (placed) {
      landmarks.push(placed);
      blocked.push(landmarkFootprint(placed.type, placed.x, placed.z));
    }
  }

  if (landmarks.length === 0) {
    for (const room of pool) {
      for (const fallbackType of types) {
        const placed = tryPlaceLandmarkInRoomOrdered(room, fallbackType, layout, blocked, landmarks);
        if (placed) {
          landmarks.push(placed);
          break;
        }
      }
      if (landmarks.length > 0) break;
    }
  }

  return landmarks;
}

/**
 * Place one vault_dais in the last sorted non-start combat room (rigid crowded only).
 */
function placeVaultDaisRigid(layout) {
  const combatRooms = layout.rooms
    .filter(r => r.role === 'combat' && !isRoomSloped(r))
    .sort((a, b) => a.x - b.x || a.z - b.z);
  if (combatRooms.length === 0) return null;

  const room = combatRooms[combatRooms.length - 1];
  const blocked = [
    ...(layout.cover || []),
    ...(layout.platforms || []),
    ...(layout.hazards || []),
  ];
  return tryPlaceLandmarkInRoomOrdered(room, 'vault_dais', layout, blocked, []);
}

/**
 * Place a canyon monolith at fixed interior offsets (rigid mode only).
 */
function placeCanyonMonolithRigid(layout) {
  const canyon = layout.rooms.find(r => r.band === 'canyon');
  if (!canyon) return null;

  const {
    spawnClearRadius,
    rigidMonolithOffsetX,
    rigidMonolithOffsetZ,
    rigidMonolithYaw,
  } = SUNKEN_CANYON;
  const margin = LANDMARK_MARGIN;
  const halfW = canyon.width / 2 - margin;
  const halfD = canyon.depth / 2 - margin;
  if (halfW <= 0 || halfD <= 0) return null;

  const cand = {
    x: canyon.x + rigidMonolithOffsetX * halfW,
    z: canyon.z + rigidMonolithOffsetZ * halfD,
    type: 'canyon_monolith',
    yaw: rigidMonolithYaw,
  };
  const fp = landmarkFootprint(cand.type, cand.x, cand.z);
  const blocked = [...(layout.cover || [])];
  const doorwayZones = roomDoorwayZones(canyon, layout.passageWidth ?? PASSAGE_WIDTH);
  if (overlapsSpawnClearAt(fp, spawnClearRadius, canyon.x, canyon.z)) return null;
  if (!acceptsLandmarkCandidate(cand, canyon, blocked, doorwayZones, margin)) return null;
  return cand;
}

/**
 * Place a single tall navigation monolith on the sunken-canyon floor (visual only).
 * Clears spawn zone and cover footprints; not routed through LANDMARK_TYPES.
 */
function placeCanyonMonolith(layout, rng) {
  const canyon = layout.rooms.find(r => r.band === 'canyon');
  if (!canyon) return null;

  const type = 'canyon_monolith';
  const { spawnClearRadius } = SUNKEN_CANYON;
  const blocked = [...(layout.cover || [])];
  const doorwayZones = roomDoorwayZones(canyon, layout.passageWidth ?? PASSAGE_WIDTH);
  const margin = LANDMARK_MARGIN;
  const halfW = canyon.width / 2 - margin;
  const halfD = canyon.depth / 2 - margin;
  if (halfW <= 0 || halfD <= 0) return null;

  const gridSteps = [-0.6, -0.3, 0.3, 0.6];
  const candidates = [];
  for (const tx of gridSteps) {
    for (const tz of gridSteps) {
      candidates.push({
        x: canyon.x + tx * halfW,
        z: canyon.z + tz * halfD,
        type,
        yaw: Math.floor(rng() * 4) * (Math.PI / 2),
      });
    }
  }
  for (let i = 0; i < 16; i++) {
    candidates.push({
      x: canyon.x + (rng() * 2 - 1) * halfW * 0.85,
      z: canyon.z + (rng() * 2 - 1) * halfD * 0.85,
      type,
      yaw: rng() * Math.PI * 2,
    });
  }
  shuffleInPlace(candidates, rng);

  for (const cand of candidates) {
    const fp = landmarkFootprint(cand.type, cand.x, cand.z);
    if (overlapsSpawnClearAt(fp, spawnClearRadius, canyon.x, canyon.z)) continue;
    if (!acceptsLandmarkCandidate(cand, canyon, blocked, doorwayZones, margin)) continue;
    return cand;
  }
  return null;
}

// ── Open profile verticality & hazards ──

const OPEN_DECOR_MARGIN = 2;
const OPEN_SPAWN_CLEAR = 5;
const OPEN_PLATFORM_MAX_RISE = 1.5;
const OPEN_HAZARD_RECESS = 0.12;
const OPEN_LOW_COVER = { width: 1.6, depth: 1.6, height: 1.0, type: 'pillar' };

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function awayFromRoomCenter(room, x, z, radius) {
  return Math.hypot(x - room.x, z - room.z) >= radius;
}

function footprintInsideRoom(room, fp, margin = OPEN_DECOR_MARGIN) {
  const halfW = room.width / 2 - margin;
  const halfD = room.depth / 2 - margin;
  return (
    Math.abs(fp.x - room.x) + fp.width / 2 <= halfW + 1e-6 &&
    Math.abs(fp.z - room.z) + fp.depth / 2 <= halfD + 1e-6
  );
}

function makePlatformCorners(rng, baseRise) {
  const spread = 0.35;
  const corners = {
    yNW: DEFAULT_FLOOR_Y + baseRise + (rng() - 0.5) * spread,
    yNE: DEFAULT_FLOOR_Y + baseRise + (rng() - 0.5) * spread,
    ySE: DEFAULT_FLOOR_Y + baseRise + (rng() - 0.5) * spread,
    ySW: DEFAULT_FLOOR_Y + baseRise + (rng() - 0.5) * spread,
  };
  const heights = [corners.yNW, corners.yNE, corners.ySE, corners.ySW];
  const minY = Math.min(...heights);
  const maxY = Math.max(...heights);
  if (maxY - minY > 0.5) {
    const mid = (minY + maxY) / 2;
    corners.yNW = corners.yNE = corners.ySE = corners.ySW = mid;
  }
  return corners;
}

function acceptsOpenFootprint(fp, room, blocked, doorwayZones) {
  if (!footprintInsideRoom(room, fp)) return false;
  if (!awayFromRoomCenter(room, fp.x, fp.z, OPEN_SPAWN_CLEAR)) return false;
  if (doorwayZones.some(z => footprintsOverlap(fp, z, 0.25))) return false;
  if (blocked.some(b => footprintsOverlap(fp, b, 0.5))) return false;
  return true;
}

function placeOpenPlatforms(rng, combatRooms, passageWidth) {
  const platforms = [];
  if (combatRooms.length === 0) return platforms;

  const pool = [...combatRooms];
  shuffleInPlace(pool, rng);
  const count = Math.min(1 + Math.floor(rng() * 2), pool.length);

  for (let i = 0; i < count; i++) {
    const room = pool[i];
    const doorwayZones = roomDoorwayZones(room, passageWidth);
    const halfW = room.width / 2 - OPEN_DECOR_MARGIN - 1;
    const halfD = room.depth / 2 - OPEN_DECOR_MARGIN - 1;
    const patchW = Math.min(room.width * 0.45, 10);
    const patchD = Math.min(room.depth * 0.45, 10);
    const baseRise = 0.6 + rng() * (OPEN_PLATFORM_MAX_RISE - 0.6);

    const offsets = [
      { tx: 0.45, tz: 0.45 }, { tx: -0.45, tz: 0.45 },
      { tx: 0.45, tz: -0.45 }, { tx: -0.45, tz: -0.45 },
      { tx: 0, tz: 0.5 }, { tx: 0, tz: -0.5 },
    ];
    shuffleInPlace(offsets, rng);

    for (const { tx, tz } of offsets) {
      const fp = {
        x: room.x + tx * halfW,
        z: room.z + tz * halfD,
        width: patchW,
        depth: patchD,
      };
      if (!acceptsOpenFootprint(fp, room, platforms, doorwayZones)) continue;
      platforms.push({
        ...fp,
        floorCorners: makePlatformCorners(rng, baseRise),
      });
      break;
    }
  }

  // Guarantee at least one raised patch when combat rooms exist.
  if (platforms.length === 0) {
    const guaranteed = guaranteeOpenPlatform(rng, combatRooms, passageWidth, platforms);
    if (guaranteed) platforms.push(guaranteed);
  }

  return platforms;
}

function guaranteeOpenPlatform(rng, combatRooms, passageWidth, blocked = []) {
  for (const room of combatRooms) {
    const doorwayZones = roomDoorwayZones(room, passageWidth);
    for (const size of [8, 6, 5, 4]) {
      const halfW = room.width / 2 - OPEN_DECOR_MARGIN - size / 2;
      const halfD = room.depth / 2 - OPEN_DECOR_MARGIN - size / 2;
      if (halfW <= 0 || halfD <= 0) continue;
      for (const tx of [-0.55, 0.55, 0]) {
        for (const tz of [-0.55, 0.55, 0]) {
          const fp = {
            x: room.x + tx * halfW,
            z: room.z + tz * halfD,
            width: size,
            depth: size,
          };
          if (!acceptsOpenFootprint(fp, room, blocked, doorwayZones)) continue;
          return {
            ...fp,
            floorCorners: makePlatformCorners(rng, 0.8),
          };
        }
      }
    }
  }
  return null;
}

function placeOpenHazards(rng, combatRooms, passageWidth, blocked) {
  const hazards = [];
  if (combatRooms.length === 0) return hazards;

  const goal = Math.min(1 + Math.floor(rng() * 2), combatRooms.length);
  const pool = [...combatRooms];
  shuffleInPlace(pool, rng);

  const pitSizes = [
    { width: 3.5, depth: 3.5 },
    { width: 4.0, depth: 2.5 },
    { width: 2.5, depth: 4.0 },
  ];

  for (let i = 0; i < goal && hazards.length < goal; i++) {
    const room = pool[i % pool.length];
    const doorwayZones = roomDoorwayZones(room, passageWidth);
    const halfW = room.width / 2 - OPEN_DECOR_MARGIN - 1;
    const halfD = room.depth / 2 - OPEN_DECOR_MARGIN - 1;
    const size = pitSizes[Math.floor(rng() * pitSizes.length)];

    const candidates = [];
    for (let t = 0; t < 12; t++) {
      candidates.push({
        x: room.x + (rng() * 2 - 1) * halfW * 0.75,
        z: room.z + (rng() * 2 - 1) * halfD * 0.75,
        width: size.width,
        depth: size.depth,
        type: 'pit',
        pitDepth: OPEN_HAZARD_RECESS,
      });
    }

    for (const cand of candidates) {
      const allBlocked = [...blocked, ...hazards];
      if (!acceptsOpenFootprint(cand, room, allBlocked, doorwayZones)) continue;
      hazards.push(cand);
      break;
    }
  }

  // Guarantee at least one pit when combat rooms exist.
  if (hazards.length === 0) {
    for (const room of combatRooms) {
      const doorwayZones = roomDoorwayZones(room, passageWidth);
      const halfW = room.width / 2 - OPEN_DECOR_MARGIN - 2;
      const halfD = room.depth / 2 - OPEN_DECOR_MARGIN - 2;
      if (halfW <= 0 || halfD <= 0) continue;
      for (const tx of [-0.5, 0.5, 0.55, -0.55]) {
        for (const tz of [-0.5, 0.5, 0.55, -0.55]) {
          const cand = {
            x: room.x + tx * halfW,
            z: room.z + tz * halfD,
            width: 3.0,
            depth: 3.0,
            type: 'pit',
            pitDepth: OPEN_HAZARD_RECESS,
          };
          if (!acceptsOpenFootprint(cand, room, blocked, doorwayZones)) continue;
          hazards.push(cand);
          break;
        }
        if (hazards.length > 0) break;
      }
      if (hazards.length > 0) break;
    }
  }

  return hazards;
}

function placeOpenCover(rng, combatRooms, passageWidth, blocked, goal) {
  const cover = [];
  if (goal <= 0 || combatRooms.length === 0) return cover;

  const pool = [...combatRooms];
  shuffleInPlace(pool, rng);

  for (const room of pool) {
    if (cover.length >= goal) break;
    const pieces = scatterCoverInRoom(rng, room, {
      targetCount: 1,
      margin: OPEN_DECOR_MARGIN,
      passageWidth,
    });
    for (const piece of pieces) {
      if (cover.length >= goal) break;
      if (blocked.some(b => footprintsOverlap(piece, b, 0.5))) continue;
      cover.push(piece);
    }
  }

  return cover;
}

function rigidPlatformCorners(baseRise) {
  const y = DEFAULT_FLOOR_Y + baseRise;
  return { yNW: y, yNE: y, ySE: y, ySW: y };
}

function placeOpenPlatformsOrdered(combatRooms, passageWidth, count) {
  const platforms = [];
  if (combatRooms.length === 0) return platforms;

  const pool = [...combatRooms].sort((a, b) => a.x - b.x || a.z - b.z);
  const baseRise = 0.8;

  const offsets = [
    { tx: 0.45, tz: 0.45 }, { tx: -0.45, tz: 0.45 },
    { tx: 0.45, tz: -0.45 }, { tx: -0.45, tz: -0.45 },
    { tx: 0, tz: 0.5 }, { tx: 0, tz: -0.5 },
  ];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const room = pool[i];
    const doorwayZones = roomDoorwayZones(room, passageWidth);
    const halfW = room.width / 2 - OPEN_DECOR_MARGIN - 1;
    const halfD = room.depth / 2 - OPEN_DECOR_MARGIN - 1;
    const patchW = Math.min(room.width * 0.45, 10);
    const patchD = Math.min(room.depth * 0.45, 10);

    for (const { tx, tz } of offsets) {
      const fp = {
        x: room.x + tx * halfW,
        z: room.z + tz * halfD,
        width: patchW,
        depth: patchD,
      };
      if (!acceptsOpenFootprint(fp, room, platforms, doorwayZones)) continue;
      platforms.push({
        ...fp,
        floorCorners: rigidPlatformCorners(baseRise),
      });
      break;
    }
  }

  if (platforms.length === 0) {
    const guaranteed = guaranteeOpenPlatformOrdered(combatRooms, passageWidth, platforms);
    if (guaranteed) platforms.push(guaranteed);
  }

  return platforms;
}

function guaranteeOpenPlatformOrdered(combatRooms, passageWidth, blocked = []) {
  const pool = [...combatRooms].sort((a, b) => a.x - b.x || a.z - b.z);
  for (const room of pool) {
    const doorwayZones = roomDoorwayZones(room, passageWidth);
    for (const size of [8, 6, 5, 4]) {
      const halfW = room.width / 2 - OPEN_DECOR_MARGIN - size / 2;
      const halfD = room.depth / 2 - OPEN_DECOR_MARGIN - size / 2;
      if (halfW <= 0 || halfD <= 0) continue;
      for (const tx of [-0.55, 0.55, 0]) {
        for (const tz of [-0.55, 0.55, 0]) {
          const fp = {
            x: room.x + tx * halfW,
            z: room.z + tz * halfD,
            width: size,
            depth: size,
          };
          if (!acceptsOpenFootprint(fp, room, blocked, doorwayZones)) continue;
          return {
            ...fp,
            floorCorners: rigidPlatformCorners(0.8),
          };
        }
      }
    }
  }
  return null;
}

function placeOpenHazardsOrdered(combatRooms, passageWidth, blocked, goal) {
  const hazards = [];
  if (combatRooms.length === 0) return hazards;

  const pool = [...combatRooms].sort((a, b) => a.x - b.x || a.z - b.z);
  const pitSizes = [
    { width: 3.5, depth: 3.5 },
    { width: 4.0, depth: 2.5 },
    { width: 2.5, depth: 4.0 },
  ];

  for (let i = 0; i < Math.min(goal, pool.length); i++) {
    const room = pool[i];
    const doorwayZones = roomDoorwayZones(room, passageWidth);
    const halfW = room.width / 2 - OPEN_DECOR_MARGIN - 1;
    const halfD = room.depth / 2 - OPEN_DECOR_MARGIN - 1;

    const candidates = [];
    for (const size of pitSizes) {
      for (const tx of [-0.5, 0.5, 0.55, -0.55]) {
        for (const tz of [-0.5, 0.5, 0.55, -0.55]) {
          candidates.push({
            x: room.x + tx * halfW,
            z: room.z + tz * halfD,
            width: size.width,
            depth: size.depth,
            type: 'pit',
            pitDepth: OPEN_HAZARD_RECESS,
          });
        }
      }
    }

    for (const cand of candidates) {
      const allBlocked = [...blocked, ...hazards];
      if (!acceptsOpenFootprint(cand, room, allBlocked, doorwayZones)) continue;
      hazards.push(cand);
      break;
    }
  }

  if (hazards.length === 0) {
    for (const room of pool) {
      const doorwayZones = roomDoorwayZones(room, passageWidth);
      const halfW = room.width / 2 - OPEN_DECOR_MARGIN - 2;
      const halfD = room.depth / 2 - OPEN_DECOR_MARGIN - 2;
      if (halfW <= 0 || halfD <= 0) continue;
      for (const tx of [-0.5, 0.5, 0.55, -0.55]) {
        for (const tz of [-0.5, 0.5, 0.55, -0.55]) {
          const cand = {
            x: room.x + tx * halfW,
            z: room.z + tz * halfD,
            width: 3.0,
            depth: 3.0,
            type: 'pit',
            pitDepth: OPEN_HAZARD_RECESS,
          };
          if (!acceptsOpenFootprint(cand, room, blocked, doorwayZones)) continue;
          hazards.push(cand);
          break;
        }
        if (hazards.length > 0) break;
      }
      if (hazards.length > 0) break;
    }
  }

  return hazards;
}

function placeOpenCoverOrdered(combatRooms, passageWidth, blocked, goal) {
  const cover = [];
  if (goal <= 0 || combatRooms.length === 0) return cover;

  const pool = [...combatRooms].sort((a, b) => a.x - b.x || a.z - b.z);

  for (const room of pool) {
    if (cover.length >= goal) break;
    const pieces = placeCoverInRoomOrdered(room, {
      targetCount: 1,
      margin: OPEN_DECOR_MARGIN,
      passageWidth,
    });
    for (const piece of pieces) {
      if (cover.length >= goal) break;
      if (blocked.some(b => footprintsOverlap(piece, b, 0.5))) continue;
      cover.push(piece);
    }
  }

  return cover;
}

/**
 * Dress sparse open grid layouts with raised platforms, shallow pit hazards,
 * and light cover scatter. Invoked only for the `open` profile.
 */
function decorateOpenLayout(layout, rng, options = {}) {
  const layoutMode = normalizeLayoutMode(options.layoutMode);
  const combatRooms = layout.rooms.filter(r => r.role === 'combat');
  const passageWidth = layout.passageWidth;
  const rigid = GRID_RIGID.open;

  let platforms;
  let hazards;
  let cover;
  if (layoutMode === 'rigid') {
    platforms = placeOpenPlatformsOrdered(combatRooms, passageWidth, rigid.platformCount);
    hazards = placeOpenHazardsOrdered(combatRooms, passageWidth, platforms, rigid.hazardCount);
    cover = placeOpenCoverOrdered(combatRooms, passageWidth, [...platforms, ...hazards], rigid.coverGoal);
  } else {
    platforms = placeOpenPlatforms(rng, combatRooms, passageWidth);
    hazards = placeOpenHazards(rng, combatRooms, passageWidth, platforms);
    const coverGoal = Math.floor(rng() * 3); // 0–2 total across the layout
    cover = placeOpenCover(rng, combatRooms, passageWidth, [...platforms, ...hazards], coverGoal);
  }

  // Optional low cover centred on a platform when both exist.
  if (platforms.length > 0 && cover.length < 2) {
    const platform = platforms[0];
    const lowCover = {
      x: platform.x,
      z: platform.z,
      ...OPEN_LOW_COVER,
    };
    if (!hazards.some(h => footprintsOverlap(lowCover, h, 0.5))) {
      cover.push(lowCover);
    }
  }

  layout.platforms = platforms;
  layout.hazards = hazards;
  layout.cover = cover;
  layout.landmarks = layoutMode === 'rigid'
    ? placeLandmarksOrdered(layout, 'open', rigid.landmarkCount)
    : placeLandmarks(layout, rng, 'open');
  return layout;
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

/** Virtual footprint radius for entry-decor spawn-clear / margin checks (visual only). */
const ENTRY_DECOR_RADIUS = 0.5;

/** Interior offset candidates for entry decor (relative to room centre). */
const ENTRY_DECOR_CANDIDATE_OFFSETS = [
  { x: -3, z: -3 },
  { x: 3, z: 3 },
  { x: -3, z: 3 },
  { x: 3, z: -3 },
  { x: 0, z: -4 },
  { x: -4, z: 0 },
  { x: 4, z: 0 },
  { x: 0, z: 4 },
  { x: -2, z: 2 },
  { x: 2, z: -2 },
  { x: 4, z: 3 },
  { x: -4, z: 3 },
  { x: 4, z: -3 },
  { x: -4, z: -3 },
  { x: 3, z: 4 },
  { x: -3, z: 4 },
  { x: 3, z: -4 },
  { x: -3, z: -4 },
];

/**
 * Greedily scatter visual-only entry decor inside a square arena. Mirrors
 * `scatterCoverInArena` margin and spawn-clear rules but skips reachability and
 * collision footprint checks.
 *
 * @returns {{ type: string, x: number, z: number, yaw?: number }[]}
 */
function overlapsSpawnClearPoint(x, z, radius, centerX, centerZ) {
  const dx = x - centerX;
  const dz = z - centerZ;
  return dx * dx + dz * dz < radius * radius;
}

function scatterEntryDecor(rng, {
  half,
  centerX = 0,
  centerZ = 0,
  spawnClear,
  type,
  count = 3,
  interiorMargin = OPEN_PLAZA.interiorMargin,
}) {
  const placed = [];
  const interiorMax = half - interiorMargin;
  // Visual-only decor may use a tighter clear zone in small entry pads so pieces
  // can sit near walls without colliding with the player spawn circle.
  const decorSpawnClear = Math.max(2.5, Math.min(spawnClear, interiorMax - 0.5));
  const targetCount = Math.max(2, Math.min(4, count));
  const shuffled = ENTRY_DECOR_CANDIDATE_OFFSETS.map(c => ({
    x: centerX + c.x,
    z: centerZ + c.z,
  }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (const cand of shuffled) {
    if (placed.length >= targetCount) break;
    if (Math.abs(cand.x - centerX) + ENTRY_DECOR_RADIUS > interiorMax) continue;
    if (Math.abs(cand.z - centerZ) + ENTRY_DECOR_RADIUS > interiorMax) continue;
    if (overlapsSpawnClearPoint(cand.x, cand.z, decorSpawnClear, centerX, centerZ)) continue;
    if (placed.some(d =>
      Math.abs(d.x - cand.x) < ENTRY_DECOR_RADIUS * 2 + 0.5 &&
      Math.abs(d.z - cand.z) < ENTRY_DECOR_RADIUS * 2 + 0.5
    )) continue;
    placed.push({
      type,
      x: cand.x,
      z: cand.z,
      yaw: rng() * Math.PI * 2,
    });
  }
  return placed;
}

/**
 * Accept entry decor from ENTRY_DECOR_CANDIDATE_OFFSETS in declaration order
 * (no RNG shuffle). Mirrors `scatterEntryDecor` margin and spawn-clear rules.
 * Used by ice-cavern and fire-cavern `layoutMode: 'rigid'` — decor is seed-independent.
 */
function placeEntryDecorOrdered({
  half,
  centerX = 0,
  centerZ = 0,
  spawnClear,
  type,
  count = 3,
  interiorMargin = OPEN_PLAZA.interiorMargin,
  avoid = [],
  yaw = 0,
}) {
  const placed = [];
  const interiorMax = half - interiorMargin;
  const decorSpawnClear = Math.max(2.5, Math.min(spawnClear, interiorMax - 0.5));
  const targetCount = Math.max(2, Math.min(4, count));

  for (const offset of ENTRY_DECOR_CANDIDATE_OFFSETS) {
    if (placed.length >= targetCount) break;
    const cand = {
      x: centerX + offset.x,
      z: centerZ + offset.z,
      width: ENTRY_DECOR_RADIUS * 2,
      depth: ENTRY_DECOR_RADIUS * 2,
    };
    if (Math.abs(cand.x - centerX) + ENTRY_DECOR_RADIUS > interiorMax) continue;
    if (Math.abs(cand.z - centerZ) + ENTRY_DECOR_RADIUS > interiorMax) continue;
    if (overlapsSpawnClearPoint(cand.x, cand.z, decorSpawnClear, centerX, centerZ)) continue;
    if (avoid.some(c => footprintsOverlap(cand, c, 0))) continue;
    if (placed.some(d =>
      Math.abs(d.x - cand.x) < ENTRY_DECOR_RADIUS * 2 + 0.5 &&
      Math.abs(d.z - cand.z) < ENTRY_DECOR_RADIUS * 2 + 0.5
    )) continue;
    placed.push({ type, x: cand.x, z: cand.z, yaw });
  }
  return placed;
}

/**
 * Accept cover from candidatePool in declaration order (no RNG shuffle).
 * Used by open-plaza `layoutMode: 'rigid'` — cover placement is seed-independent.
 */
function placeCoverInArenaOrdered({
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

  for (const cand of candidatePool) {
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

function flatFloorCorners(y = DEFAULT_FLOOR_Y) {
  return { yNW: y, yNE: y, ySE: y, ySW: y };
}

/**
 * Flat stone connector between ice-cavern bands (no elevation change).
 */
function buildIceCavernConnectorRoom({ x, z, width, depth, openWest = false, openEast = false }) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const walls = [];
  if (!openWest) walls.push({ x: x - halfW, z, length: depth, axis: 'z' });
  if (!openEast) walls.push({ x: x + halfW, z, length: depth, axis: 'z' });
  return {
    x,
    z,
    width,
    depth,
    walls,
    floorCorners: flatFloorCorners(),
    band: 'ramp',
    role: 'connector',
    spawnWeight: 0,
    floorSurface: 'normal',
  };
}

/** Inset from each perimeter wall plane for arena banner/tier decor (visual only). */
const PERIMETER_DECOR_INSET = 2;

/**
 * Deterministic colosseum dressing along the open-plaza perimeter: banner poles
 * and tiered seating blocks just inside each wall (no RNG).
 *
 * @param {number} half - half-width of the plaza (OPEN_PLAZA.size / 2)
 * @returns {Array<{ type: string, x: number, z: number, yaw?: number, wall: string }>}
 */
function placeOpenPlazaPerimeterDecor(half) {
  const inset = PERIMETER_DECOR_INSET;
  const inner = half - inset;
  const along = [-9, 9];

  /** @type {Array<{ type: string, x: number, z: number, yaw?: number, wall: string }>} */
  const decor = [];

  for (const x of along) {
    decor.push({ type: 'arena_banner', x, z: -inner, wall: 'north', yaw: 0 });
    decor.push({ type: 'arena_tier', x, z: inner, wall: 'south', yaw: Math.PI });
  }
  for (const z of along) {
    decor.push({ type: 'arena_tier', x: -inner, z, wall: 'west', yaw: Math.PI / 2 });
    decor.push({ type: 'arena_banner', x: inner, z, wall: 'east', yaw: -Math.PI / 2 });
  }

  return decor;
}

/**
 * Place 1–2 shallow pit hazards on the open-plaza floor. Visual-only recesses;
 * they do not participate in collision or floor sampling.
 *
 * @param {object[]} blocked - platforms and cover footprints to avoid
 */
function placeOpenPlazaHazards(rng, half, spawnClear, blocked) {
  const hazards = [];
  const interiorMax = half - OPEN_PLAZA.interiorMargin;
  const goal = 1 + Math.floor(rng() * 2);

  const pitSizes = [
    { width: 3.5, depth: 3.5 },
    { width: 4.0, depth: 2.5 },
    { width: 2.5, depth: 4.0 },
  ];

  const candidates = [];
  for (let t = 0; t < 24; t++) {
    const size = pitSizes[Math.floor(rng() * pitSizes.length)];
    const span = half - OPEN_PLAZA.interiorMargin - Math.max(size.width, size.depth) / 2 - 0.5;
    if (span <= 0) continue;
    candidates.push({
      x: (rng() * 2 - 1) * span,
      z: (rng() * 2 - 1) * span,
      width: size.width,
      depth: size.depth,
      type: 'pit',
      pitDepth: OPEN_HAZARD_RECESS,
    });
  }

  for (const cand of candidates) {
    if (hazards.length >= goal) break;
    if (Math.abs(cand.x) + cand.width / 2 > interiorMax) continue;
    if (Math.abs(cand.z) + cand.depth / 2 > interiorMax) continue;
    if (overlapsSpawnClearAt(cand, spawnClear, 0, 0)) continue;
    const allBlocked = [...blocked, ...hazards];
    if (allBlocked.some(b => footprintsOverlap(cand, b, 0.5))) continue;
    hazards.push(cand);
  }

  if (hazards.length === 0) {
    const fallbacks = [
      { x: 0, z: 11, width: 3.0, depth: 3.0 },
      { x: 11, z: 0, width: 3.0, depth: 3.0 },
      { x: -11, z: 0, width: 3.0, depth: 3.0 },
      { x: 0, z: -11, width: 3.0, depth: 3.0 },
      { x: -11, z: -5, width: 3.5, depth: 3.5 },
      { x: 11, z: 5, width: 3.5, depth: 3.5 },
    ];
    for (const cand of fallbacks) {
      const pit = {
        ...cand,
        type: 'pit',
        pitDepth: OPEN_HAZARD_RECESS,
      };
      if (Math.abs(pit.x) + pit.width / 2 > interiorMax) continue;
      if (Math.abs(pit.z) + pit.depth / 2 > interiorMax) continue;
      if (overlapsSpawnClearAt(pit, spawnClear, 0, 0)) continue;
      if (blocked.some(b => footprintsOverlap(pit, b, 0.5))) continue;
      hazards.push(pit);
      break;
    }
  }

  return hazards;
}

/**
 * Fixed pit positions for open-plaza `layoutMode: 'rigid'`.
 * Seed-independent — rigid layouts differ across seeds only in fields that
 * remain constant here (platforms, perimeter decor, etc. are also fixed).
 */
const OPEN_PLAZA_RIGID_HAZARDS = [
  { x: -5, z: 10, width: 3.0, depth: 3.0, type: 'pit', pitDepth: OPEN_HAZARD_RECESS },
  { x: -8, z: -4, width: 3.0, depth: 3.0, type: 'pit', pitDepth: OPEN_HAZARD_RECESS },
];

/**
 * Place rigid-mode pit hazards at fixed positions (no RNG).
 * @param {object[]} blocked - platforms and cover footprints to avoid
 */
function placeOpenPlazaHazardsRigid(half, spawnClear, blocked) {
  const hazards = [];
  const interiorMax = half - OPEN_PLAZA.interiorMargin;

  for (const template of OPEN_PLAZA_RIGID_HAZARDS) {
    const cand = { ...template };
    if (Math.abs(cand.x) + cand.width / 2 > interiorMax) continue;
    if (Math.abs(cand.z) + cand.depth / 2 > interiorMax) continue;
    if (overlapsSpawnClearAt(cand, spawnClear, 0, 0)) continue;
    const allBlocked = [...blocked, ...hazards];
    if (allBlocked.some(b => footprintsOverlap(cand, b, 0.5))) continue;
    hazards.push(cand);
  }

  return hazards;
}

/**
 * Emissive cliff-edge lip AABBs at the high (plateau) mouth of each descent ramp.
 * Strips sit on the plateau just north of the ramp junction — not over walkable ramp centres.
 */
function buildSunkenCanyonCliffLips(rampCenters, rampWidth, yHigh, plateauSouthZ) {
  const { cliffLipStripDepth, cliffLipPlateauInset } = SUNKEN_CANYON;
  const halfW = rampWidth / 2;
  const maxZ = plateauSouthZ - cliffLipPlateauInset;
  const minZ = maxZ - cliffLipStripDepth;

  return rampCenters.map(rampX => ({
    minX: rampX - halfW,
    maxX: rampX + halfW,
    minZ,
    maxZ,
    y: yHigh,
  }));
}

/**
 * Thin hazard strips along the plateau south cliff between ramp gap openings.
 * AABBs sit on solid rim segments only — not across ramp mouths.
 */
function buildSunkenCanyonCliffHazards(plateau, rampCenters, rampWidth, yHigh) {
  const { cliffHazardStripDepth, cliffHazardEndPadding } = SUNKEN_CANYON;
  const halfW = plateau.width / 2;
  const halfD = plateau.depth / 2;
  const plateauSouthZ = plateau.z + halfD;
  const leftEdge = plateau.x - halfW;
  const rightEdge = plateau.x + halfW;

  const rawGaps = rampCenters
    .map((cx) => ({ left: cx - rampWidth / 2, right: cx + rampWidth / 2 }))
    .filter((gap) => gap.right > leftEdge && gap.left < rightEdge)
    .map((gap) => ({
      left: Math.max(gap.left, leftEdge),
      right: Math.min(gap.right, rightEdge),
    }))
    .sort((a, b) => a.left - b.left);

  const mergedGaps = [];
  for (const gap of rawGaps) {
    const last = mergedGaps[mergedGaps.length - 1];
    if (last && gap.left <= last.right + 0.01) {
      last.right = Math.max(last.right, gap.right);
    } else {
      mergedGaps.push({ ...gap });
    }
  }

  const edgeHazards = [];
  let cursor = leftEdge;

  for (const gap of mergedGaps) {
    const segLeft = cursor + cliffHazardEndPadding;
    const segRight = gap.left - cliffHazardEndPadding;
    if (segRight > segLeft + 0.01) {
      edgeHazards.push({
        minX: segLeft,
        maxX: segRight,
        minZ: plateauSouthZ - cliffHazardStripDepth,
        maxZ: plateauSouthZ,
        y: yHigh,
        side: 'south',
        band: 'plateau',
      });
    }
    cursor = Math.max(cursor, gap.right);
  }

  const segLeft = cursor + cliffHazardEndPadding;
  const segRight = rightEdge - cliffHazardEndPadding;
  if (segRight > segLeft + 0.01) {
    edgeHazards.push({
      minX: segLeft,
      maxX: segRight,
      minZ: plateauSouthZ - cliffHazardStripDepth,
      maxZ: plateauSouthZ,
      y: yHigh,
      side: 'south',
      band: 'plateau',
    });
  }

  // When central ramps tile the south rim (no X gaps), place southern flank
  // strips on the west/east plateau edges so cliff tension remains reachable.
  if (edgeHazards.length === 0) {
    const flankMinZ = plateau.z + halfD * 0.2;
    const flankMaxZ = plateauSouthZ - cliffHazardEndPadding;
    edgeHazards.push({
      minX: leftEdge,
      maxX: leftEdge + cliffHazardStripDepth,
      minZ: flankMinZ,
      maxZ: flankMaxZ,
      y: yHigh,
      side: 'west',
      band: 'plateau',
    });
    edgeHazards.push({
      minX: rightEdge - cliffHazardStripDepth,
      maxX: rightEdge,
      minZ: flankMinZ,
      maxZ: flankMaxZ,
      y: yHigh,
      side: 'east',
      band: 'plateau',
    });
  }

  return edgeHazards;
}

/**
 * Build the open-plaza arena: one large walkable room bounded by four solid
 * perimeter walls, with scattered cover pieces and gently sloped platforms.
 * Deterministic for a given seed (uses mulberry32) in `layoutMode: 'default'`.
 * In `layoutMode: 'rigid'`, cover/hazard placement is seed-independent.
 *
 * Returns { rooms: [plaza], passages: [], cover, platforms, passageWidth,
 *           cellSpacing, profile: 'open-plaza' }.
 */
function generateOpenPlaza(seed, options = {}) {
  const layoutMode = normalizeLayoutMode(options.layoutMode);
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

  // Three gently sloped platforms at distinct corners (corner delta ≤ 0.5 each).
  const platforms = [
    { x: -9, z: -9, width: 6, depth: 6, floorCorners: { yNW: 1.3, yNE: 1.6, ySE: 1.7, ySW: 1.4 } },
    { x: 9, z: 9, width: 6, depth: 6, floorCorners: { yNW: 1.6, yNE: 1.4, ySE: 1.6, ySW: 1.5 } },
    { x: 9, z: -9, width: 6, depth: 6, floorCorners: { yNW: 1.6, yNE: 1.5, ySE: 1.7, ySW: 1.5 } },
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
    { x: -5, z: -11, width: 3.5, depth: 1.0, height: 1.1, type: 'barricade' },
    { x: 5, z: 11, width: 3.5, depth: 1.0, height: 1.1, type: 'barricade' },
    { x: 11, z: -11, width: 1.8, depth: 1.8, height: 2.2, type: 'crate_stack' },
    { x: -11, z: 11, width: 1.8, depth: 1.8, height: 2.2, type: 'crate_stack' },
  ];

  let hazards;
  if (layoutMode === 'rigid') {
    const allCover = placeCoverInArenaOrdered({
      half,
      spawnClear,
      candidatePool,
      initialCover: cover,
      targetCount: 8,
      interiorMargin: OPEN_PLAZA.interiorMargin,
    });
    cover.length = 0;
    cover.push(...allCover);
    hazards = placeOpenPlazaHazardsRigid(half, spawnClear, [...platforms, ...cover]);
  } else {
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
    hazards = placeOpenPlazaHazards(rng, half, spawnClear, [...platforms, ...cover]);
  }

  const layout = {
    rooms: [plaza],
    passages: [],
    cover,
    hazards,
    platforms,
    floorMarkings: [
      { type: 'center_ring', x: 0, z: 0, innerRadius: 3.5, outerRadius: 4.5 },
    ],
    landmarks: [{ x: 0, z: 0, type: 'arena_dais' }],
    perimeterDecor: placeOpenPlazaPerimeterDecor(half),
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

/**
 * Rift-theme floor bands: an ice decal over the west half of the arena and an
 * ember decal over the east half. Cosmetic floor markings only — flat
 * rectangles (centre x/z plus width/depth extents) that add no walls or
 * cover. Inset from the arena walls and stopped short of the centre ring so
 * the decals lie fully inside bounds and never overlap the center_ring
 * marking.
 */
function buildRiftFloorMarkings(half) {
  const innerX = RIFT_THEME.bandInnerX;
  const outerX = half - RIFT_THEME.bandWallInset;
  const width = outerX - innerX;
  const depth = (half - RIFT_THEME.bandWallInset) * 2;
  const centerX = (innerX + outerX) / 2;
  return [
    { type: 'rift_ice_band', x: -centerX, z: 0, width, depth },
    { type: 'rift_ember_band', x: centerX, z: 0, width, depth },
  ];
}

/**
 * Build the boss-arena layout: one compact walkable room with a centre
 * `arena_dais` landmark and sparse cover. Deterministic for a given seed in
 * `layoutMode: 'default'`; rigid mode uses seed-independent cover placement.
 * `options.arenaTheme: 'rift'` appends ice/ember floor-band markings (cosmetic
 * decals only); any other value leaves the layout untouched.
 *
 * Returns { rooms: [arena], passages: [], cover, floorMarkings, landmarks,
 *           passageWidth, cellSpacing, profile: 'boss-arena' }.
 */
function generateBossArena(seed, options = {}) {
  const layoutMode = normalizeLayoutMode(options.layoutMode);
  const rng = mulberry32(seed);
  const size = BOSS_ARENA.size;
  const half = size / 2;
  const spawnClear = BOSS_ARENA.spawnClearRadius;

  const walls = [
    { x: 0, z: -half, length: size, axis: 'x' },
    { x: 0, z: half, length: size, axis: 'x' },
    { x: -half, z: 0, length: size, axis: 'z' },
    { x: half, z: 0, length: size, axis: 'z' },
  ];

  const arena = {
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

  const candidatePool = [
    { x: -7, z: -7, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 7, z: -7, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: -7, z: 7, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 7, z: 7, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 0, z: -8, width: 3.0, depth: 1.0, height: 1.0, type: 'barricade' },
    { x: 0, z: 8, width: 3.0, depth: 1.0, height: 1.0, type: 'barricade' },
  ];

  const cover = [];
  const scatterOpts = {
    half,
    spawnClear,
    candidatePool,
    initialCover: cover,
    targetCount: BOSS_ARENA.coverTargetCount,
    interiorMargin: BOSS_ARENA.interiorMargin,
  };
  const placedCover = layoutMode === 'rigid'
    ? placeCoverInArenaOrdered(scatterOpts)
    : scatterCoverInArena(rng, scatterOpts);

  const layout = {
    rooms: [arena],
    passages: [],
    cover: placedCover,
    floorMarkings: [
      { type: 'center_ring', x: 0, z: 0, innerRadius: 2.5, outerRadius: 3.2 },
    ],
    landmarks: [{ x: 0, z: 0, type: 'arena_dais' }],
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: size,
    profile: 'boss-arena',
  };

  if (options.arenaTheme === 'rift') {
    layout.floorMarkings.push(...buildRiftFloorMarkings(half));
  }

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
function generateSunkenCanyon(seed, options = {}) {
  const layoutMode = normalizeLayoutMode(options.layoutMode);
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
    rigidCentralRampCount,
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
  const sortedOffsets = [...rampXOffsets].sort((a, b) => a - b);
  const centralRampCenters = layoutMode === 'rigid'
    ? sortedOffsets.slice(0, rigidCentralRampCount)
    : (() => {
      const numRamps = 2 + Math.floor(rng() * 2);
      return numRamps === 2
        ? [sortedOffsets[0], sortedOffsets[sortedOffsets.length - 1]]
        : sortedOffsets;
    })();
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

  const cover = layoutMode === 'rigid'
    ? placeCoverInArenaOrdered({
      half: canyonHalf,
      centerX: canyonX,
      centerZ: canyonZ,
      spawnClear: spawnClearRadius,
      candidatePool: canyonCandidatePool,
      targetCount: 8,
      interiorMargin,
    })
    : scatterCoverInArena(rng, {
      half: canyonHalf,
      centerX: canyonX,
      centerZ: canyonZ,
      spawnClear: spawnClearRadius,
      candidatePool: canyonCandidatePool,
      targetCount: 8,
      interiorMargin,
    });

  const cliffLips = buildSunkenCanyonCliffLips(rampCenters, rampWidth, yHigh, plateauSouthZ);
  const edgeHazards = buildSunkenCanyonCliffHazards(plateau, rampCenters, rampWidth, yHigh);

  const layoutBase = {
    rooms: [plateau, ...ramps, canyon],
    passages: [],
    cover,
    cliffLips,
    edgeHazards,
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: canyonSize,
    profile: 'sunken-canyon',
  };

  const monolith = layoutMode === 'rigid'
    ? placeCanyonMonolithRigid(layoutBase)
    : placeCanyonMonolith(layoutBase, rng);

  return {
    ...layoutBase,
    landmarks: monolith ? [monolith] : [],
  };
}

// ── Ice Cavern Stage Generation ──

/**
 * Build the ice-cavern stage: a stone entry dock north of a large slippery ice
 * sheet with a stone treasure pad to the south. One or two flat stone ramps
 * bridge entry ↔ ice; the treasure pad opens through a centred wall gap.
 *
 * In `layoutMode: 'default'`, ramp count (1–2), cover scatter and entry-decor
 * scatter are seed-driven. In `layoutMode: 'rigid'`, geometry is fixed and
 * seed-independent: 2 outer ramps, declaration-order pad cover, fixed decor.
 *
 * Returns { rooms, passages, cover, passageWidth, cellSpacing,
 *           profile: 'ice-cavern' }.
 */
function generateIceCavern(seed, options = {}) {
  const layoutMode = normalizeLayoutMode(options.layoutMode);
  const rng = mulberry32(seed);
  const {
    stonePadSize,
    iceSize,
    rampWidth,
    rampDepth,
    spawnClearRadius,
    interiorMargin,
    rampXOffsets,
    treasureGapWidth,
    rigidRampCount,
    rigidCoverPerStonePad,
    rigidEntryDecorCount,
    rigidPadSpawnClear,
  } = ICE_CAVERN;

  const y = DEFAULT_FLOOR_Y;
  const stoneHalf = stonePadSize / 2;
  const iceHalf = iceSize / 2;
  const rampHalfW = rampWidth / 2;

  const iceX = 0;
  const iceZ = 0;
  const iceNorthZ = iceZ - iceHalf;
  const iceSouthZ = iceZ + iceHalf;

  const northRampZ = iceNorthZ - rampDepth / 2;
  const entryZ = northRampZ - rampDepth / 2 - stoneHalf;
  const treasureZ = iceSouthZ + stoneHalf;

  const sortedOffsets = [...rampXOffsets].sort((a, b) => a - b);
  const numRamps = layoutMode === 'rigid' ? rigidRampCount : 1 + Math.floor(rng() * 2);
  const rampCenters = numRamps === 1
    ? [sortedOffsets[1]]
    : [sortedOffsets[0], sortedOffsets[sortedOffsets.length - 1]];

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
    buildIceCavernConnectorRoom({
      x: rampX,
      z: northRampZ,
      width: rampWidth,
      depth: rampDepth,
      openWest: isRampEdgeInsideOtherRamp(rampX - rampHalfW, rampX),
      openEast: isRampEdgeInsideOtherRamp(rampX + rampHalfW, rampX),
    })
  );

  const entryWalls = [
    { x: 0, z: entryZ - stoneHalf, length: stonePadSize, axis: 'x' },
    { x: -stoneHalf, z: entryZ, length: stonePadSize, axis: 'z' },
    { x: stoneHalf, z: entryZ, length: stonePadSize, axis: 'z' },
    ...buildHorizontalWallWithGaps(entryZ + stoneHalf, 0, stonePadSize, rampCenters, rampWidth),
  ];

  const entry = {
    x: 0,
    z: entryZ,
    width: stonePadSize,
    depth: stonePadSize,
    walls: entryWalls,
    floorCorners: flatFloorCorners(y),
    band: 'entry',
    role: 'start',
    spawnWeight: 0,
    encounterTier: 0,
    floorSurface: 'normal',
  };

  const iceWalls = [
    ...buildHorizontalWallWithGaps(iceNorthZ, iceX, iceSize, rampCenters, rampWidth),
    ...buildHorizontalWallWithGaps(iceSouthZ, iceX, iceSize, [iceX], treasureGapWidth),
    { x: iceX - iceHalf, z: iceZ, length: iceSize, axis: 'z' },
    { x: iceX + iceHalf, z: iceZ, length: iceSize, axis: 'z' },
  ];

  const iceField = {
    x: iceX,
    z: iceZ,
    width: iceSize,
    depth: iceSize,
    walls: iceWalls,
    floorCorners: flatFloorCorners(y),
    band: 'ice',
    spawnWeight: 2,
    encounterTier: 0,
    floorSurface: 'slippery',
  };

  const treasureNorthZ = treasureZ - stoneHalf;
  const treasureWalls = [
    ...buildHorizontalWallWithGaps(treasureNorthZ, iceX, stonePadSize, [iceX], treasureGapWidth),
    { x: iceX, z: treasureZ + stoneHalf, length: stonePadSize, axis: 'x' },
    { x: iceX - stoneHalf, z: treasureZ, length: stonePadSize, axis: 'z' },
    { x: iceX + stoneHalf, z: treasureZ, length: stonePadSize, axis: 'z' },
  ];

  const treasure = {
    x: iceX,
    z: treasureZ,
    width: stonePadSize,
    depth: stonePadSize,
    walls: treasureWalls,
    floorCorners: flatFloorCorners(y),
    band: 'stone',
    role: 'treasure',
    spawnWeight: 0,
    encounterTier: 0,
    floorSurface: 'normal',
  };

  const stoneCandidatePool = [
    { x: -3, z: -3, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 3, z: 3, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: -3, z: 3, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: 3, z: -3, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
  ];

  // Rigid mode anchors the pool to each pad centre so cover lands on the pads;
  // default mode must keep passing the pool untranslated (scatterCoverInArena
  // reads candidate coordinates as absolute) so its output stays bit-identical.
  const padCandidatePool = pad =>
    stoneCandidatePool.map(c => ({ ...c, x: pad.x + c.x, z: pad.z + c.z }));

  const entryCover = layoutMode === 'rigid'
    ? placeCoverInArenaOrdered({
      half: stoneHalf,
      centerX: entry.x,
      centerZ: entry.z,
      spawnClear: rigidPadSpawnClear,
      candidatePool: padCandidatePool(entry),
      targetCount: rigidCoverPerStonePad,
      interiorMargin,
    })
    : scatterCoverInArena(rng, {
      half: stoneHalf,
      centerX: entry.x,
      centerZ: entry.z,
      spawnClear: spawnClearRadius,
      candidatePool: stoneCandidatePool,
      targetCount: 2,
      interiorMargin,
    });

  const treasureCover = layoutMode === 'rigid'
    ? placeCoverInArenaOrdered({
      half: stoneHalf,
      centerX: treasure.x,
      centerZ: treasure.z,
      spawnClear: rigidPadSpawnClear,
      candidatePool: padCandidatePool(treasure),
      targetCount: rigidCoverPerStonePad,
      interiorMargin,
    })
    : scatterCoverInArena(rng, {
      half: stoneHalf,
      centerX: treasure.x,
      centerZ: treasure.z,
      spawnClear: spawnClearRadius,
      candidatePool: stoneCandidatePool,
      targetCount: 2,
      interiorMargin,
    });

  const entryDecor = layoutMode === 'rigid'
    ? placeEntryDecorOrdered({
      half: stoneHalf,
      centerX: entry.x,
      centerZ: entry.z,
      spawnClear: spawnClearRadius,
      type: 'icicle_cluster',
      count: rigidEntryDecorCount,
      interiorMargin,
      avoid: entryCover,
    })
    : scatterEntryDecor(rng, {
      half: stoneHalf,
      centerX: entry.x,
      centerZ: entry.z,
      spawnClear: spawnClearRadius,
      type: 'icicle_cluster',
      count: 2 + Math.floor(rng() * 3),
      interiorMargin,
    });

  const passages = ramps.map((ramp) => ({
    x1: entry.x,
    z1: entry.z,
    x2: ramp.x,
    z2: ramp.z,
    walls: [],
  }));

  return {
    rooms: [entry, ...ramps, iceField, treasure],
    passages,
    cover: [...entryCover, ...treasureCover],
    entryDecor,
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: iceSize,
    profile: 'ice-cavern',
    landmarks: [{ x: treasure.x, z: treasure.z, type: 'ice_cairn' }],
  };
}


// ── Fire Cavern Stage Generation ──

/**
 * Build the fire-cavern stage: a high rim spawn band overlooking a large lower
 * volcanic basin, connected by 2–3 sloped ramp rooms. Deterministic for a
 * given seed.
 *
 * Returns { rooms, passages: [], cover, passageWidth, cellSpacing,
 *           profile: 'fire-cavern' }.
 */
function generateFireCavern(seed, options = {}) {
  const layoutMode = normalizeLayoutMode(options.layoutMode);
  const rng = mulberry32(seed);
  const {
    rimSize,
    basinSize,
    rampWidth,
    rampDepth,
    yDrop,
    spawnClearRadius,
    interiorMargin,
    rampXOffsets,
    rigidRampCount,
    rigidCoverTargetCount,
    rigidEntryDecorCount,
  } = FIRE_CAVERN;

  const yHigh = DEFAULT_FLOOR_Y + yDrop;
  const yLow = DEFAULT_FLOOR_Y;
  const basinHalf = basinSize / 2;
  const rimHalf = rimSize / 2;

  // Basin centred at origin; rim sits to the north (negative Z).
  const basinX = 0;
  const basinZ = 0;
  const basinNorthZ = basinZ - basinHalf;
  const rampZ = basinNorthZ - rampDepth / 2;
  const rampNorthZ = rampZ - rampDepth / 2;
  const rimZ = rampNorthZ - rimHalf;
  const rimSouthZ = rimZ + rimHalf;

  const sortedOffsets = [...rampXOffsets].sort((a, b) => a - b);
  const rampCenters = layoutMode === 'rigid'
    ? sortedOffsets.slice(0, rigidRampCount)
    : (() => {
      const numRamps = 2 + Math.floor(rng() * 2);
      return numRamps === 2
        ? [sortedOffsets[0], sortedOffsets[sortedOffsets.length - 1]]
        : sortedOffsets;
    })();
  const rampHalfW = rampWidth / 2;
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

  const rimWalls = [
    { x: 0, z: rimZ - rimHalf, length: rimSize, axis: 'x' }, // north
    { x: -rimHalf, z: rimZ, length: rimSize, axis: 'z' },    // west
    { x: rimHalf, z: rimZ, length: rimSize, axis: 'z' },     // east
    ...buildHorizontalWallWithGaps(rimSouthZ, 0, rimSize, rampCenters, rampWidth),
  ];

  const rim = {
    x: 0,
    z: rimZ,
    width: rimSize,
    depth: rimSize,
    walls: rimWalls,
    floorCorners: { yNW: yHigh, yNE: yHigh, ySE: yHigh, ySW: yHigh },
    band: 'entry',
    role: 'start',
    spawnWeight: 0,
    encounterTier: 0,
  };

  const basinWalls = [
    ...buildHorizontalWallWithGaps(basinNorthZ, basinX, basinSize, rampCenters, rampWidth),
    { x: basinX, z: basinZ + basinHalf, length: basinSize, axis: 'x' }, // south
    { x: basinX - basinHalf, z: basinZ, length: basinSize, axis: 'z' }, // west
    { x: basinX + basinHalf, z: basinZ, length: basinSize, axis: 'z' }, // east
  ];

  const basin = {
    x: basinX,
    z: basinZ,
    width: basinSize,
    depth: basinSize,
    walls: basinWalls,
    floorCorners: { yNW: yLow, yNE: yLow, ySE: yLow, ySW: yLow },
    band: 'basin',
    role: 'treasure',
    spawnWeight: 2,
    encounterTier: 0,
  };

  const basinCandidatePool = [
    { x: 0, z: -11, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 0, z: 11, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: -11, z: 0, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 11, z: 0, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
    { x: 9, z: -9, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: -9, z: 9, width: 4.0, depth: 1.2, height: 1.0, type: 'broken_wall' },
    { x: -11, z: -11, width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
    { x: 11, z: 11, width: 1.2, depth: 4.0, height: 1.0, type: 'broken_wall' },
  ];

  const cover = layoutMode === 'rigid'
    ? placeCoverInArenaOrdered({
      half: basinHalf,
      centerX: basinX,
      centerZ: basinZ,
      spawnClear: spawnClearRadius,
      candidatePool: basinCandidatePool,
      targetCount: rigidCoverTargetCount,
      interiorMargin,
    })
    : scatterCoverInArena(rng, {
      half: basinHalf,
      centerX: basinX,
      centerZ: basinZ,
      spawnClear: spawnClearRadius,
      candidatePool: basinCandidatePool,
      targetCount: 8,
      interiorMargin,
    });

  const entryDecor = layoutMode === 'rigid'
    ? placeEntryDecorOrdered({
      half: rimHalf,
      centerX: rim.x,
      centerZ: rim.z,
      spawnClear: spawnClearRadius,
      type: 'ember_vent',
      count: rigidEntryDecorCount,
      interiorMargin,
    })
    : scatterEntryDecor(rng, {
      half: rimHalf,
      centerX: rim.x,
      centerZ: rim.z,
      spawnClear: spawnClearRadius,
      type: 'ember_vent',
      count: 2 + Math.floor(rng() * 3),
      interiorMargin,
    });

  return {
    rooms: [rim, ...ramps, basin],
    passages: [],
    cover,
    entryDecor,
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: basinSize,
    profile: 'fire-cavern',
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
 * In `layoutMode: 'default'`, tier count (3–5) and tier width/depth (12–15)
 * are seed-driven. In `layoutMode: 'rigid'`, those values are fixed.
 *
 * Returns { rooms, passages: [], passageWidth, cellSpacing, profile: 'spire-ascent',
 *   edgeHazards, landmarks: [{ type: 'spire_summit', x, z }] }.
 */
function generateSpireAscent(seed, options = {}) {
  const layoutMode = normalizeLayoutMode(options.layoutMode);
  const {
    tierMinSize,
    tierMaxSize,
    tierXStep,
    rampWidth,
    rampDepth,
    minTotalRise,
    minRampSlope,
    rigidTierCount,
    rigidTierWidth,
    rigidTierDepth,
  } = SPIRE_ASCENT;

  let tierCount;
  let tierWidth;
  let tierDepth;
  if (layoutMode === 'rigid') {
    tierCount = rigidTierCount;
    tierWidth = rigidTierWidth;
    tierDepth = rigidTierDepth;
  } else {
    const rng = mulberry32(seed);
    tierCount = 3 + Math.floor(rng() * 3);
    const tierSpan = tierMaxSize - tierMinSize + 1;
    tierWidth = tierMinSize + Math.floor(rng() * tierSpan);
    tierDepth = tierMinSize + Math.floor(rng() * tierSpan);
  }

  const yStep = minTotalRise / (tierCount - 1);
  if (yStep / rampDepth < minRampSlope) {
    throw new Error('SPIRE_ASCENT rampDepth too large for minRampSlope');
  }
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
  const treasureRoom = tiers[tierCount - 1];

  return {
    rooms,
    passages: [],
    passageWidth: PASSAGE_WIDTH,
    cellSpacing: Math.max(tierWidth, totalSpan),
    profile: 'spire-ascent',
    edgeHazards,
    landmarks: [{ x: treasureRoom.x, z: treasureRoom.z, type: 'spire_summit' }],
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
  normalizeLayoutMode,
  generateLayout,
  generateOpenPlaza,
  generateBossArena,
  generateSunkenCanyon,
  generateIceCavern,
  generateFireCavern,
  buildSunkenCanyonCliffLips,
  buildSunkenCanyonCliffHazards,
  generateSpireAscent,
  buildSpireEdgeHazards,
  generateHub,
  buildDescentRampRoom,
  scatterCoverInArena,
  scatterEntryDecor,
  placeCoverInArenaOrdered,
  placeEntryDecorOrdered,
  OPEN_PLAZA_RIGID_HAZARDS,
  scatterCoverInRoom,
  decorateCrowdedLayout,
  decorateOpenLayout,
  placeLandmarks,
  LANDMARK_TYPES,
  LANDMARK_FOOTPRINTS,
  roomDoorwayZones,
  roomFullyReachable,
  buildAdjacencyMap,
  bfsDistances,
  findFarthestRoom,
  assignRoomRoles,
  roomsByRole,
  randomRoomPositionByRole,
  sampleFloorY,
  sampleFloorSurface,
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
