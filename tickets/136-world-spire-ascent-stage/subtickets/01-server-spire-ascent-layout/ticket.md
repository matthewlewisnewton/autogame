# Server: Spire Ascent layout generation

Add a `spire-ascent` stage profile to `generateLayout()` that produces a vertical
tower of **3–5 stacked tier rooms** connected by **ascending ramp rooms**, with
total floor-Y gain from bottom spawn to top exit ≥ 10 units. Include perimeter
walls on every tier and ramp, explicit room roles/bands, and deterministic
generation.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns a layout with `profile:
  'spire-ascent'`.
- Layout contains **3–5 tier rooms** (`band: 'tier'`), each with `tierIndex`
  0 … N−1. Each tier is room-sized (~12–15 units wide/deep) with flat
  `floorCorners` (all four corners equal within a tier).
- **Monotonic elevation**: `sampleFloorY` at tier *k* centre is strictly greater
  than at tier *k−1* centre for every *k* ≥ 1.
- **Exactly one ramp room** (`band: 'ramp'`) between each consecutive tier pair
  (N tiers ⇒ N−1 ramps). Each ramp uses `buildDescentRampRoom` (or equivalent)
  with non-uniform `floorCorners`, **average slope ≥ 0.2** (rise/run on the
  dominant axis), and continuous Y from the lower tier to the upper tier (no
  vertical cliff).
- **Total Y gain** from tier-0 spawn centre to top-tier centre ≥ 10 units
  (measured via `sampleFloorY`).
- **Perimeter walls** on the outer edge of every tier and ramp-side walls on
  ramps so players cannot walk off the spire; ramp mouths align with tier edges
  so the full route is walkable.
- Roles assigned explicitly (do not rely on hop-distance `assignRoomRoles`):
  tier 0 = `start`, top tier = `treasure`, middle tiers = `combat`, ramps =
  `connector` with `spawnWeight: 0`.
- **Reachability**: foot flood-fill from tier-0 centre reaches every tier room
  and the top-tier centre via walkable AABBs + wall colliders only (no orphan
  tiers).
- Deterministic: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: profile shape, tier
  count 3–5, monotonic Y, ramp count = tiers−1, ramp slope ≥ 0.2, total Y gain ≥
  10, full reachability, no orphan tier, and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and branch in `generateLayout()` to
    `generateSpireAscent(seed)` (mirror `generateSunkenCanyon`).
  - Add `SPIRE_ASCENT` tuning constants: tier size (~12–15), ramp width/depth,
    `minTiers: 3`, `maxTiers: 5`, `minTotalYGain: 10`, `minRampSlope: 0.2`.
  - **`generateSpireAscent(seed)`**:
    - Pick tier count `N = 3 + floor(rng() * 3)` (3–5 inclusive).
    - Place tier 0 at the bottom (low Y, positive Z) and stack tiers toward
      negative Z (or consistent axis), raising Y per tier so cumulative gain ≥
      10.
    - Between each tier *i* and *i+1*, place one `buildDescentRampRoom` with
      `yLow` at tier *i* elevation and `yHigh` at tier *i+1*; choose ramp depth
      so rise/run ≥ 0.2.
    - Each tier room: flat `floorCorners`, `band: 'tier'`, `tierIndex`, four
      perimeter walls with a single gap on the face that meets the ramp.
    - Return `{ rooms, passages: [], passageWidth, cellSpacing, profile:
      'spire-ascent' }` (ramps are rooms, not passages, so `sampleFloorY` works
      without passage changes).
    - Set roles: bottom `start`, top `treasure`, middle `combat`, ramps
      `connector` / `spawnWeight: 0`.
  - Export `generateSpireAscent` from `module.exports` for tests.
- `game/server/simulation.js`: no change expected; confirm tier/ramp walls and
  `buildWallColliders` enclose the tower.
- Tests: new `describe("generateLayout(seed, 'spire-ascent')")` block in
  `game/server/test/dungeon.test.js` with helpers for tier/ramp detection,
  slope, Y-gain, reachability flood-fill (reuse patterns from the
  `sunken-canyon` describe block).

## Verification: code
