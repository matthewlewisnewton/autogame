# Server: Sunken Canyon layout generation

Add a `sunken-canyon` stage profile to `generateLayout()` that produces a high
plateau spawn band, a large lower canyon floor (≥ 4× a default room), and 2–3
sloped ramp rooms connecting them with a total descent ≥ 8 units. Include
perimeter walls, optional canyon cover scatter, and deterministic generation.

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon')` returns a layout with `profile:
  'sunken-canyon'`.
- Exactly **two elevation bands** are identifiable in `layout.rooms`:
  - **Plateau**: one room-sized walkable area (~12–15 units wide/deep) with all
    `floorCorners` at the high band Y (plateau center Y).
  - **Canyon**: one walkable area with width × depth ≥ 4 × 182 units² (≥ 728
    units²).
- **2–3 ramp rooms** connect plateau → canyon. Each ramp room has non-uniform
  `floorCorners` (high edge on the plateau side, low edge on the canyon side),
  average slope ≥ 0.15 (rise/run using the dominant axis length), and no
  vertical cliff between bands (every ramp bridges the Y gap continuously).
- Plateau center Y minus canyon center Y ≥ 8 units (measured via
  `sampleFloorY` at room centers).
- Both bands have **solid perimeter walls** (no walk-off gaps at the outer
  edge of the stage). Ramp mouths align with plateau/canyon edges so the full
  route is walkable.
- Layout includes `layout.cover` on the canyon floor (≥ 6 pieces, same shape as
  open-plaza: `pillar` / `broken_wall`), placed with the same reachability and
  spawn-clear rules as `generateOpenPlaza` (reuse or extract a shared scatter
  helper).
- Each room carries `band: 'plateau' | 'ramp' | 'canyon'` for downstream spawn
  logic. Roles are assigned explicitly (do not rely on default
  `assignRoomRoles` hop-distance): plateau = `start`, canyon = `treasure`,
  ramps = `connector` with `spawnWeight: 0`.
- Deterministic: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: profile shape, two
  bands, ramp count 2–3, Y drop ≥ 8, ramp slope ≥ 0.15, full foot
  reachability from plateau spawn to canyon floor via ramps only (grid/flood
  using `computeWalkableAABBs` + wall colliders, same pattern as open-plaza
  reachability tests), and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'sunken-canyon'` to `LAYOUT_PROFILES` and branch in `generateLayout()`
    to `generateSunkenCanyon(seed)` (mirror the `open-plaza` pattern).
  - Export a reusable **`buildDescentRampRoom({ x, z, width, depth, yHigh,
    yLow, axis })`** helper that returns a thin room object with `floorCorners`,
    `walls` along the ramp sides, and `band: 'ramp'`. Share this helper with
    future spire-ascent work (136); document the export.
  - **`generateSunkenCanyon(seed)`**:
    - Plateau at negative Z (or north), canyon at positive Z below, separated
      by vertical Y so the vista looks down into the canyon.
    - Place 2–3 ramp rooms at distinct X offsets (e.g. west / center / east
      bridges) so paths do not overlap.
    - Canyon room: reuse `OPEN_PLAZA.size` (32) or equivalent for area ≥ 4×
      default room; `floorCorners` flat at low Y.
    - Call cover scatter (lift greedy loop from `generateOpenPlaza` into
      `scatterCoverInArena(rng, half, spawnClear, candidatePool)` if needed).
    - Return `{ rooms, passages: [], cover, passageWidth, cellSpacing, profile:
      'sunken-canyon' }`. Ramps are rooms, not passages, so `sampleFloorY`
      works without passage sampling changes.
  - Set plateau `role: 'start'`, canyon `role: 'treasure'`, ramps
    `role: 'connector'`, `spawnWeight: 0`.
- `game/server/simulation.js`: confirm `buildWallColliders` already adds
  `layout.cover` AABBs (open-plaza path); no change expected, but verify canyon
  cover is collidable.
- Tests: new `describe("generateLayout(seed, 'sunken-canyon')")` block in
  `game/server/test/dungeon.test.js` with helpers for band detection, slope,
  Y-drop, and reachability flood-fill.

## Verification: code
