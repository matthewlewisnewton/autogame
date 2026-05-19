# Extract Layout Generator to Dedicated Module

Move `mulberry32` PRNG and `generateLayout()` from `server/index.js` into a new `game/server/dungeon.js` module. This makes the generator independently testable and importable by both server and client.

## Acceptance Criteria
- `game/server/dungeon.js` exports `mulberry32(seed)` returning a PRNG function
- `game/server/dungeon.js` exports `generateLayout(seed)` returning `{ rooms, passages }`
- `generateLayout(seed)` is deterministic: same seed always produces identical output
- Every generated layout has ≥4 rooms and all rooms are reachable (connected graph)
- `server/index.js` imports from `dungeon.js` instead of defining inline
- Existing server behavior (layout on startup, `resetGameState` regeneration) is unchanged
- Unit tests cover: determinism, room count, connectivity, and wall gap correctness

## Technical Specs
- **New file**: `game/server/dungeon.js` — contains `mulberry32`, `generateLayout`, and exported constants (`GRID_COLS`, `GRID_ROWS`, `CELL_SPACING`, `MIN_ROOM_SIZE`, `MAX_ROOM_SIZE_INCLUSIVE`, `PASSAGE_WIDTH`)
- **Modify**: `game/server/index.js` — replace inline `mulberry32`/`generateLayout` with `import { generateLayout, mulberry32 } from './dungeon.js'` (or `require`)
- **New file**: `game/server/test/dungeon.test.js` — unit tests for `generateLayout`

## Verification: code
