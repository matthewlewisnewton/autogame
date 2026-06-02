# Server: Spire Ascent layout generation

Add a `spire-ascent` stage profile to `generateLayout()` that produces a vertical
tower of **3–5 flat tier platforms** linked by **ascending ramp rooms**, with total
floor-Y gain from bottom spawn to top tier ≥ 10 units and perimeter walls on every
tier and ramp.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns a layout with `profile:
  'spire-ascent'`.
- **3–5 tier rooms** (`band: 'tier'`, `tierIndex: 0..N-1`): each tier is
  room-sized (~12–15 units wide/deep) with uniform `floorCorners` (flat platform).
  Tier `n` has a strictly greater floor Y than tier `n-1` (compare platform center
  via `sampleFloorY` or shared corner Y).
- **N−1 ramp rooms** connect consecutive tiers (one ramp per step). Each ramp uses
  `buildDescentRampRoom` (or a thin wrapper) with high edge on the upper tier side,
  low edge on the lower tier side, `band: 'ramp'`, non-uniform `floorCorners`, and
  **average slope ≥ 0.2** (rise/run on the dominant axis).
- **Total Y gain** from bottom-tier spawn center to top-tier center ≥ 10 units
  (measured with `sampleFloorY`).
- **Perimeter walls** on the outer edge of every tier and both long sides of every
  ramp; ramp mouths align with tier edges so the full route is walkable with no
  walk-off gaps at the spire exterior.
- Each room carries explicit roles (do not rely on default `assignRoomRoles` hop
  distance over an empty `passages` list): bottom tier = `start`, top tier =
  `treasure`, middle tiers = `combat`, ramps = `connector` with `spawnWeight: 0`.
- Layout returns `{ rooms, passages: [], passageWidth, cellSpacing, profile:
  'spire-ascent' }` (ramps are rooms so `sampleFloorY` works without passage
  sampling changes).
- **Deterministic**: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: tier count 3–5, monotonic
  Y per tier, ramp count = tierCount − 1, each ramp slope ≥ 0.2, total Y gain ≥
  10, full foot reachability from bottom spawn to top tier via ramps only (flood
  using `computeWalkableAABBs` + wall colliders, same pattern as sunken-canyon),
  no orphan tier (every tier room is reachable), and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and branch in `generateLayout()` to
    `generateSpireAscent(seed)` (mirror `sunken-canyon` / `open-plaza`).
  - Add `SPIRE_ASCENT` constants: `tierMinSize` / `tierMaxSize` (~12–15),
    `rampWidth`, `rampDepth`, `minTotalRise: 10`, `minRampSlope: 0.2`.
  - **`generateSpireAscent(seed)`**:
    - Pick `tierCount = 3 + Math.floor(rng() * 3)` (3, 4, or 5).
    - Place tiers along −Z (bottom/start at highest +Z, top/treasure at lowest −Z)
      with Y stepping up each tier: `yTier[i] = DEFAULT_FLOOR_Y + i * yStep` where
      `yStep` is chosen so `(tierCount - 1) * yStep >= minTotalRise`.
    - Between each pair of tiers, insert one `buildDescentRampRoom({ yHigh, yLow,
      axis: 'z', ... })` bridging the shared edge (low +Z side of upper tier meets
      high −Z side of ramp going upward toward north).
    - Build tier `walls` with `buildHorizontalWallWithGaps` on the north edge
      (ramp opening) and solid walls on west, east, and south exterior edges;
      mirror gap logic on ramps so only the tier connection is open.
    - Tag tiers with `band: 'tier'`, `tierIndex`, ramps with `band: 'ramp'`.
    - Set roles/`spawnWeight` explicitly as in acceptance criteria.
  - Reuse exported **`buildDescentRampRoom`**; add `buildAscentRampRoom` alias only
    if it clarifies call sites (same geometry, swapped `yHigh`/`yLow` semantics).
  - Export `generateSpireAscent` from `module.exports` for tests.
- `game/server/simulation.js`: no change expected — confirm tier/ramp `walls` feed
  `buildWallColliders` like sunken-canyon.
- Tests: new `describe("generateLayout(seed, 'spire-ascent')")` in
  `game/server/test/dungeon.test.js` with helpers `roomsByBand`, `rampAverageSlope`,
  tier Y ordering, reachability flood, and determinism (copy patterns from the
  sunken-canyon block).

## Verification: code
