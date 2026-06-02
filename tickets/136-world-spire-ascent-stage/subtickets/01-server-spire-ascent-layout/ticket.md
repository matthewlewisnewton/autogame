# Server: Spire Ascent layout generation

Add a `spire-ascent` stage profile to `generateLayout()` that produces 3–5
stacked flat tier platforms connected by sloped ramp rooms, climbing from a
bottom spawn tier to a top exit tier with total Y gain ≥ 10 units. Include
perimeter walls on every tier and ramp side, explicit room roles/bands, and
deterministic generation.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns a layout with `profile:
  'spire-ascent'`.
- Layout contains **3–5 tier rooms** (`band: 'tier'`), each ~12–15 units
  wide/deep with uniform `floorCorners` at that tier's Y. Tier index `n` sits
  strictly above tier `n-1` in world Y (monotonic ascent).
- **One ramp room** connects each consecutive tier pair (`band: 'ramp'`). Each
  ramp uses non-uniform `floorCorners` (low edge on the lower tier side, high
  edge on the upper tier side), average slope ≥ 0.2 (rise/run on the dominant
  axis length), and bridges the Y gap continuously (no vertical cliff).
- Total Y gain from tier-0 spawn center to top-tier center ≥ 10 units
  (measured via `sampleFloorY` at room centers).
- Every tier and ramp has **solid perimeter walls** on outer spire edges (south
  edge of bottom tier, north edge of top tier, west/east on all tiers, ramp side
  walls from the ramp builder). Ramp mouths align with tier edges so the full
  climb is walkable with no fall-off gaps.
- Room metadata for downstream spawns:
  - Bottom tier: `role: 'start'`, `tierIndex: 0`, `spawnWeight: 0`
  - Top tier: `role: 'treasure'`, highest `tierIndex`, `spawnWeight: 2`
  - Middle tiers: `role: 'combat'`, `spawnWeight: 1`, `encounterTier` increasing
    with height
  - Ramps: `role: 'connector'`, `spawnWeight: 0`
- **Reachability**: foot path from tier-0 center to top-tier center via ramps
  only (grid/flood using `computeWalkableAABBs` + wall colliders; every tier
  room reachable — no orphan tiers).
- Deterministic: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: profile shape, tier
  count 3–5, monotonic Y per tier, ramp slope ≥ 0.2, total Y gain ≥ 10, full
  foot reachability, no orphan tiers, and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and branch in `generateLayout()`
    to `generateSpireAscent(seed)` (mirror the `sunken-canyon` pattern).
  - Add `SPIRE_ASCENT` tuning constants: tier size (~13), ramp width/depth,
    `yGainTotal` (≥ 10), tier count range 3–5.
  - Reuse exported **`buildDescentRampRoom({ x, z, width, depth, yHigh, yLow,
    axis })`** for each tier transition (low Y faces the lower tier, high Y the
    upper tier; `axis: 'z'` with tiers stacked along −Z → +Z as Y rises).
  - **`generateSpireAscent(seed)`**:
    - Pick `numTiers = 3 + floor(rng() * 3)`.
    - Place tier 0 (lowest Y) at the south end; stack tiers northward with one
      ramp between each pair.
    - Distribute total Y rise across ramps so sum ≥ 10 and each ramp meets the
      ≥ 0.2 slope floor given ramp depth.
    - Build perimeter walls per tier using `buildHorizontalWallWithGaps` at
      north/south junctions (ramp mouth only) and solid west/east walls.
    - Return `{ rooms, passages: [], passageWidth, cellSpacing, profile:
      'spire-ascent' }`. Ramps are rooms (not passages) so `sampleFloorY` works
      without passage changes.
  - Export `generateSpireAscent` from `module.exports` if tests need direct
    access (optional; `generateLayout` is sufficient).
- `game/server/simulation.js`: confirm `buildWallColliders` / `computeWalkableAABBs`
  already handle multi-room sloped layouts (sunken-canyon path); no change
  expected unless tier AABB union needs a tweak.
- Tests: new `describe("generateLayout(seed, 'spire-ascent')")` block in
  `game/server/test/dungeon.test.js` with helpers for tier detection
  (`band === 'tier'`, `tierIndex`), slope, Y-gain, reachability flood-fill, and
  orphan-tier check (`countReachableRooms === layout.rooms.length`).

## Verification: code
