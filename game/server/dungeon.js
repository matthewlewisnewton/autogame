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

// Grid dimensions and spacing for room placement
const GRID_COLS = 4;
const GRID_ROWS = 4;
const CELL_SPACING = 20; // center-to-center distance between adjacent cells
const MIN_ROOM_SIZE = 12;
const MAX_ROOM_SIZE_INCLUSIVE = 15;
const PASSAGE_WIDTH = 4;

/**
 * Generate a deterministic dungeon layout from a numeric seed.
 * Returns { rooms: [...], passages: [...] }
 */
function generateLayout(seed) {
  const rng = mulberry32(seed);

  // Step 1 — place rooms by growth so every room is guaranteed connected
  // Start from a random seed cell, then repeatedly add a random unoccupied
  // neighbour of an existing room until we reach the target count.
  const grid = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    grid[r] = new Array(GRID_COLS).fill(false);
  }
  const cellPositions = []; // [{r, c, x, z}]

  const startR = Math.floor(rng() * GRID_ROWS);
  const startC = Math.floor(rng() * GRID_COLS);
  const startZ = (startR - (GRID_ROWS - 1) / 2) * CELL_SPACING;
  const startX = (startC - (GRID_COLS - 1) / 2) * CELL_SPACING;
  grid[startR][startC] = true;
  cellPositions.push({ r: startR, c: startC, x: startX, z: startZ });

  // Target: at least 4 rooms, up to grid capacity
  const maxRooms = GRID_ROWS * GRID_COLS;
  const targetRooms = Math.max(4, Math.min(maxRooms, Math.floor(GRID_ROWS * GRID_COLS * 0.6)));

  while (cellPositions.length < targetRooms) {
    // Build frontier: unoccupied neighbours of existing rooms
    const frontier = [];
    for (const cell of cellPositions) {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = cell.r + dr;
        const nc = cell.c + dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && !grid[nr][nc]) {
          frontier.push({ r: nr, c: nc });
        }
      }
    }

    if (frontier.length === 0) break; // grid is full

    // Pick a random frontier cell and add it
    const pick = frontier[Math.floor(rng() * frontier.length)];
    grid[pick.r][pick.c] = true;
    const px = (pick.c - (GRID_COLS - 1) / 2) * CELL_SPACING;
    const pz = (pick.r - (GRID_ROWS - 1) / 2) * CELL_SPACING;
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
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && grid[nr][nc]) {
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
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && grid[nr][nc]) {
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
  const extraCount = Math.min(Math.floor(possibleExtra.length * 0.3), possibleExtra.length);
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
    const width = MIN_ROOM_SIZE + Math.floor(rng() * (MAX_ROOM_SIZE_INCLUSIVE - MIN_ROOM_SIZE + 1));
    const depth = MIN_ROOM_SIZE + Math.floor(rng() * (MAX_ROOM_SIZE_INCLUSIVE - MIN_ROOM_SIZE + 1));
    const halfW = width / 2;
    const halfD = depth / 2;
    const sides = passageSides[idx];
    const walls = [];
    const gap = PASSAGE_WIDTH;

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

    return { x: cell.x, z: cell.z, width, depth, walls };
  });

  // Step 6 — build passage objects with boundary walls
  const passageObjects = passages.map(p => {
    const from = cellPositions[p.from];
    const to = cellPositions[p.to];
    const walls = [];
    const halfGap = PASSAGE_WIDTH / 2;

    // Horizontal passage (same row, different column)
    if (from.r === to.r) {
      const wallCentreX = (from.x + to.x) / 2;
      walls.push({ x: wallCentreX, z: from.z - halfGap, length: CELL_SPACING, axis: 'x' });
      walls.push({ x: wallCentreX, z: from.z + halfGap, length: CELL_SPACING, axis: 'x' });
    }

    // Vertical passage (same column, different row)
    if (from.c === to.c) {
      const wallCentreZ = (from.z + to.z) / 2;
      walls.push({ x: from.x - halfGap, z: wallCentreZ, length: CELL_SPACING, axis: 'z' });
      walls.push({ x: from.x + halfGap, z: wallCentreZ, length: CELL_SPACING, axis: 'z' });
    }

    return { x1: from.x, z1: from.z, x2: to.x, z2: to.z, walls };
  });

  return { rooms, passages: passageObjects };
}

// ── Exports ──

module.exports = {
  mulberry32,
  generateLayout,
  GRID_COLS,
  GRID_ROWS,
  CELL_SPACING,
  MIN_ROOM_SIZE,
  MAX_ROOM_SIZE_INCLUSIVE,
  PASSAGE_WIDTH
};
