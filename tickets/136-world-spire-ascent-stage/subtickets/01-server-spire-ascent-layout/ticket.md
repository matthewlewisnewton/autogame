# Server: Spire Ascent layout generation

Add a `spire-ascent` stage profile to `generateLayout()` that produces **3–5
stacked flat tiers** (each ≈ one normal room) connected by **sloped ramp rooms**
using `buildDescentRampRoom`, with **≥ 10 units** total floor-Y gain from the
bottom spawn tier to the top tier and solid perimeter walls on every tier and
ramp.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns a layout with `profile:
  'spire-ascent'` and `passages: []` (ramps are rooms so `sampleFloorY` works
  without passage changes).
- **Tier count** is 3–5 inclusive, chosen deterministically from the seed.
- Each **tier** is a flat room (`floorCorners` uniform) with width/depth in the
  ~12–15 unit range (same scale as default dungeon rooms / sunken-canyon
  plateau). Tier `n` center Y is **strictly greater** than tier `n-1` center Y
  (monotonic ascent).
- **Exactly one ramp room** connects each adjacent tier pair (tier count − 1
  ramps). Each ramp has non-uniform `floorCorners`, `band: 'ramp'`, average
  slope ≥ **0.2** (rise/run on the dominant axis), and bridges the Y gap
  continuously (no vertical cliff between tiers).
- **Total Y gain** from spawn (`role: 'start'` tier center via `sampleFloorY`)
  to top tier center is ≥ **10** units.
- Every tier and every ramp has **perimeter side walls** so players cannot walk
  off the spire; ramp mouths align with tier edges so the full climb is
  walkable on foot (no jumping).
- Rooms carry `band: 'tier' | 'ramp'` and `tierIndex` on tier rooms (0 =
  bottom). Roles are assigned **explicitly** (do not rely on passage-based
  `assignRoomRoles`): bottom tier = `start`, top tier = `treasure`, ramps =
  `connector` with `spawnWeight: 0`.
- **Reachability**: flood/grid test from bottom-tier spawn to top-tier center
  using `computeWalkableAABBs` + `buildWallColliders` reaches all rooms (no
  orphan tier).
- **Deterministic**: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: profile shape, tier
  count 3–5, monotonic tier Y, ramp slope ≥ 0.2, total Y gain ≥ 10, perimeter
  walls present, full foot reachability, no orphan rooms, and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and branch in `generateLayout()`
    to `generateSpireAscent(seed)` (mirror `sunken-canyon` / `open-plaza`).
  - Add `SPIRE_ASCENT` tuning constants (tier size ~12–15, ramp width/depth,
    per-tier Y step sized so total gain ≥ 10 for 3–5 tiers).
  - Implement **`generateSpireAscent(seed)`**:
    - Stack tiers along **+Z** (bottom tier at low Z / low Y, top tier at high
      Z / high Y) so the stage reads as an upward climb.
    - Reuse exported **`buildDescentRampRoom({ x, z, width, depth, yHigh,
      yLow, axis })`** for each tier→tier connector (`yHigh` on the upper-tier
      side, `yLow` on the lower-tier side; `axis: 'z'` matches canyon ramps).
    - Build tier perimeter walls with **`buildHorizontalWallWithGaps`** (or
      equivalent) on the edge that opens to the ramp; solid walls on the other
      three sides and on ramp side walls from `buildDescentRampRoom`.
    - Return `{ rooms, passages: [], passageWidth, cellSpacing, profile:
      'spire-ascent' }`.
  - Export `generateSpireAscent` from `module.exports` if other modules need
    it for tests.
- `game/server/simulation.js`: no change expected — tier/ramp rooms already
  contribute to `computeWalkableAABBs` and wall colliders like canyon ramps.
- Tests: new `describe("generateLayout(seed, 'spire-ascent')")` in
  `game/server/test/dungeon.test.js` with helpers for `tierIndex`, ramp slope,
  Y-gain, and reachability (reuse patterns from the sunken-canyon block:
  `buildWallColliders`, `computeWalkableAABBs`, `countReachableRooms`).

## Verification: code
