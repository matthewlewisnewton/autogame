# Server: Spire Ascent layout generation

Add a `spire-ascent` stage profile to `generateLayout()` that produces a vertical
tower of **3–5 stacked tier rooms** connected by sloped ramp rooms, with total
floor-Y gain from bottom spawn to top exit ≥ 10 units. Include perimeter walls on
every tier and ramp, explicit tier metadata, and deterministic generation.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns a layout with `profile:
  'spire-ascent'`.
- Layout contains **3–5 tier rooms** (`band: 'tier'`), each room-sized (~12–15
  units wide/deep) with **uniform** `floorCorners` (flat platform). Tier index
  `tierIndex` runs 0 (bottom) through `N-1` (top).
- **Monotonic elevation**: `sampleFloorY` at each tier centre is strictly greater
  than the tier below (tier `n` Y > tier `n-1` Y for all `n > 0`).
- **(N−1) ramp rooms** (`band: 'ramp'`) connect consecutive tiers. Each ramp uses
  non-uniform `floorCorners` (low edge at the lower tier, high edge at the upper
  tier), **average slope ≥ 0.2** (rise/run on the dominant axis), and bridges the
  Y gap continuously (no vertical cliff between tiers).
- **Total Y gain** from tier-0 centre (`start`) to tier-(N−1) centre (`treasure`)
  is **≥ 10 units** (measured via `sampleFloorY`).
- **Perimeter walls** on every tier and ramp side walls from
  `buildDescentRampRoom` — no walk-off gaps at the outer edge of the spire
  (north/south/east/west of the stacked column).
- Each room carries `band: 'tier' | 'ramp'` and `tierIndex` on tier rooms. Roles
  are assigned explicitly: tier 0 = `start`, top tier = `treasure`, middle tiers =
  `combat`, ramps = `connector` with `spawnWeight: 0`.
- **Reachability**: flood/grid test from tier-0 centre to top-tier centre via
  walkable AABBs + wall colliders only (ramps on foot, no jumping).
- **No orphan tiers**: every tier is adjacent to at least one ramp in the linear
  chain (tier₀ → ramp → tier₁ → … → tierₙ).
- Deterministic: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: profile shape, tier
  count 3–5, monotonic Y, ramp slope ≥ 0.2, total Y gain ≥ 10, ramp graph
  reachability from spawn to top, no orphan tier, and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and branch in `generateLayout()`
    to `generateSpireAscent(seed)` (mirror `sunken-canyon` / `open-plaza`).
  - Reuse exported **`buildDescentRampRoom({ x, z, width, depth, yHigh, yLow,
    axis })`** for inter-tier ramps (`axis: 'z'`: high Y at north / −Z, low Y at
    south / +Z). Stack tiers along **−Z (north) = higher elevation** so the bottom
    spawn sits at the south (+Z) base and players climb northward.
  - Add **`SPIRE_ASCENT`** constants (tier size ~12–15, ramp width/depth, min
    total rise 10, per-ramp min slope 0.2). Derive per-ramp rise so
    `sum(rises) ≥ 10` across `N−1` ramps for any tier count `N ∈ [3, 5]`.
  - **`generateSpireAscent(seed)`**:
    - `numTiers = 3 + floor(rng() * 3)` (3–5 inclusive).
    - Place tier rooms in a vertical stack with gaps filled by thin ramp rooms;
      set flat `floorCorners` on each tier at `yBase + tierIndex * risePerTier`.
    - Wrap each tier with solid perimeter walls (reuse
      `buildHorizontalWallWithGaps` only on faces that open into ramps).
    - Return `{ rooms, passages: [], passageWidth, cellSpacing, profile:
      'spire-ascent' }`. Ramps are rooms (not passages) so `sampleFloorY` works
      unchanged.
  - Export `generateSpireAscent` from the module for tests.
- `game/server/simulation.js`: confirm tier/ramp rooms appear in
  `computeWalkableAABBs` (same as other room-based stages); no passage changes.
- Tests: new `describe("generateLayout(seed, 'spire-ascent')")` in
  `game/server/test/dungeon.test.js` with helpers `roomsByBand`, `tierRooms`,
  `rampAverageSlope`, and reachability flood (reuse patterns from the
  `sunken-canyon` describe block).

## Verification: code
