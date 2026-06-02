# Server: Spire Ascent layout generation

Add a `spire-ascent` stage profile to `generateLayout()` that produces **3–5
stacked tier rooms** (each ≈ one normal room) connected by **sloped ramp rooms**
using `buildDescentRampRoom`, with total floor-Y gain from bottom spawn to top
tier ≥ 10 units, perimeter walls on every tier and ramp, and deterministic
generation.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns a layout with `profile:
  'spire-ascent'` and `passages: []` (ramps are rooms, like sunken-canyon).
- Layout contains **3–5 tier rooms** (`band: 'tier'`, `tierIndex` 0 … N−1).
  Each tier is a flat platform: all four `floorCorners` share the same Y, and
  tier `n` center Y is **strictly greater** than tier `n−1` center Y (monotonic
  ascent).
- Between each adjacent pair of tiers there is exactly **one ramp room**
  (`band: 'ramp'`) with non-uniform `floorCorners`, **average slope ≥ 0.2**
  (rise/run on the dominant axis), and continuous Y from the lower tier to the
  higher tier (no vertical cliff at junctions).
- **Total Y gain** from spawn (tier 0 center via `sampleFloorY`) to top-tier
  center is **≥ 10 units** for every seed in a test sweep (e.g. seeds 1–30).
- **Perimeter walls** on every tier and ramp side: no walk-off gaps on the outer
  edge of the spire column; ramp mouths align with tier edges so the full route
  is walkable on foot.
- Roles assigned explicitly (do not rely on `assignRoomRoles` hop-distance over
  empty `passages`): bottom tier = `start`, top tier = `treasure`, middle tiers
  = `combat`, ramps = `connector` with `spawnWeight: 0`.
- **Reachability**: foot flood-fill using `computeWalkableAABBs` +
  `buildWallColliders` reaches every room from tier-0 spawn; no orphan tier.
- **Ramp graph**: every tier index 0…N−1 is connected via consecutive ramps only
  (no skipped tier).
- Deterministic: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` in a new
  `describe("generateLayout(seed, 'spire-ascent')")` block cover: profile,
  tier count 3–5, monotonic tier Y, ramp count = tier count − 1, slope ≥
  0.2, Y gain ≥ 10, perimeter walls, full-room reachability, ramp-graph
  connectivity, and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and branch in `generateLayout()`
    to `generateSpireAscent(seed)` (mirror `sunken-canyon` / `open-plaza`).
  - Add `SPIRE_ASCENT` tuning constants: tier width/depth (~12–15), ramp
    width/depth, `minTiers: 3`, `maxTiers: 5`, `minTotalYGain: 10`,
    `minRampSlope: 0.2`.
  - **`generateSpireAscent(seed)`**:
    - Pick `numTiers = 3 + floor(rng() * 3)` (3–5 inclusive).
    - Stack tiers along **−Z** (bottom/spawn tier at highest +Z, top tier at
      lowest −Z) or the inverse — pick one convention and document it; bottom
      tier at `DEFAULT_FLOOR_Y`, distribute Y steps so
      `yTop − yBottom ≥ 10`.
    - For each tier, emit a flat room with four perimeter walls and a **north
      wall gap** (except top tier) aligned to the ramp above; bottom tier south
      edge fully walled.
    - Between tiers, call existing **`buildDescentRampRoom`** (`axis: 'z'`,
      `yHigh` on the higher tier side, `yLow` on the lower) and add ramp side
      walls so players cannot walk off the ramp sides.
    - Tag rooms: `band: 'tier' | 'ramp'`, `tierIndex` on tiers, export
      `generateSpireAscent` in `module.exports`.
  - Reuse **`buildHorizontalWallWithGaps`** from sunken-canyon for tier/ramp
    mouth alignment.
- `game/server/simulation.js`: no change expected; confirm tier/ramp rooms
  appear in `computeWalkableAABBs` like other sloped rooms.
- Tests: helpers `roomsByBand`, `tierCenterY`, `rampAverageSlope` (same pattern
  as sunken-canyon block in `dungeon.test.js`); reuse `countReachableRooms` and
  plateau→treasure `canReachPoint` flood-fill.

## Verification: code
