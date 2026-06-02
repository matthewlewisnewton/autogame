# Server: Spire Ascent layout generation

Add a `spire-ascent` stage profile to `generateLayout()` that produces **3–5
stacked tier rooms** (each ≈ one normal room) connected by **sloped ramp rooms**
with total climb ≥ 10 units from bottom spawn to top exit. Include perimeter
walls on every tier and ramp so players cannot walk off the spire.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns a layout with `profile:
  'spire-ascent'`.
- **3–5 tier rooms** (`band: 'tier'`, with `tierIndex` 0 … n−1). Each tier is
  a flat (uniform `floorCorners`) room-sized platform (~12–15 units wide/deep).
- **Monotonic elevation**: for every tier `i > 0`, the tier’s uniform floor Y
  is **strictly greater** than tier `i − 1` (measured at room center via
  `sampleFloorY`).
- **One ramp room** between each adjacent tier pair (`band: 'ramp'`). Each ramp
  has non-uniform `floorCorners` bridging the two tier Y values, average slope
  ≥ **0.2** (rise/run on the dominant axis), and `role: 'connector'`,
  `spawnWeight: 0`.
- **Total Y gain** from spawn (tier 0 center) to top tier center ≥ **10** units.
- **Perimeter walls** on the outer edge of every tier and both long sides of
  every ramp — no walk-off gaps at the spire boundary. Ramp mouths align with
  tier edges so the climb is continuous on foot (no jumps).
- **Roles assigned explicitly** (do not rely on `assignRoomRoles` hop-distance):
  bottom tier = `start`, top tier = `treasure`, intermediate tiers = `combat`,
  ramps = `connector`.
- **Reachability**: flood-fill / grid walk using `computeWalkableAABBs` +
  `buildWallColliders` confirms every tier is reachable from spawn via ramps only;
  no orphan tier.
- **Deterministic**: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: profile shape, tier
  count 3–5, monotonic Y, ramp count = tier count − 1, ramp slope ≥ 0.2, total
  climb ≥ 10, perimeter walls present, full reachability, no orphan tier, and
  determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and branch in `generateLayout()`
    to `generateSpireAscent(seed)` (mirror `sunken-canyon` / `open-plaza`).
  - Add `SPIRE_ASCENT` tuning constants (tier size, ramp width/depth, minimum
    rise per ramp so `(numTiers − 1) × rise ≥ 10`).
  - Implement **`generateSpireAscent(seed)`**:
    - Pick `numTiers` in 3–5 with `mulberry32(seed)`.
    - Stack tiers along **−Z** (north = up): bottom spawn tier at the south (+Z)
      end, each higher tier to the north, separated by thin ramp rooms.
    - Reuse exported **`buildDescentRampRoom({ x, z, width, depth, yHigh,
      yLow, axis })`** with `axis: 'z'` (low Y at south / lower tier, high Y at
      north / upper tier) so walking spawn → exit ascends.
    - Each tier: flat `floorCorners`, four perimeter walls (north/south walls
      use `buildHorizontalWallWithGaps` at ramp mouths), `band: 'tier'`,
      `tierIndex`.
    - Return `{ rooms, passages: [], passageWidth, cellSpacing, profile:
      'spire-ascent' }` (ramps are rooms, not passages, so `sampleFloorY`
      works without passage changes).
  - Export `generateSpireAscent` from `module.exports`.
- `game/server/simulation.js`: confirm `buildWallColliders` includes tier/ramp
  `walls` (same as other bespoke stages); no change expected unless gaps found.
- Tests: new `describe("generateLayout(seed, 'spire-ascent')")` in
  `game/server/test/dungeon.test.js` with helpers for tier bands, slope, Y
  climb, reachability flood-fill (reuse patterns from the `sunken-canyon`
  describe block).

## Verification: code
