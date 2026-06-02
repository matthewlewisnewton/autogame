# Server: Spire Ascent layout generation

Add a `spire-ascent` stage profile to `generateLayout()` that produces **3–5
stacked flat tiers** (room-sized platforms) connected by **sloped ramp rooms**,
with total floor-Y gain from bottom spawn to top exit ≥ 10 units, ramp average
slope ≥ 0.2, and solid perimeter walls so players cannot walk off the spire.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns a layout with `profile:
  'spire-ascent'`.
- Layout contains **3–5 tier rooms** (`band` starts with `'tier-'`, e.g.
  `'tier-0'` … `'tier-N'`). Each tier is a flat (uniform `floorCorners`) platform
  ~12–15 units wide/deep. Tier `n` centre Y is **strictly greater** than tier
  `n-1` centre Y (monotonic ascent).
- **Exactly `tierCount - 1` ramp rooms** connect consecutive tiers. Each ramp has
  non-uniform `floorCorners`, `band: 'ramp'`, average slope ≥ **0.2** (rise/run
  on the dominant axis), and bridges the Y gap between adjacent tiers without a
  vertical cliff.
- `sampleFloorY` at the **start** tier centre vs the **treasure** tier centre
  differs by ≥ **10** units (for seeds 1, 42, 123, 777).
- **Perimeter walls** on every tier and ramp: no walk-off gaps at the outer edge
  of the spire. Ramp mouths align with tier edges so the full route is walkable.
- Explicit roles (do not rely on default `assignRoomRoles` hop-distance):
  bottom tier = `start`, top tier = `treasure`, middle tiers = `combat` with
  distinct `encounterTier` / `spawnWeight`, ramps = `connector` with
  `spawnWeight: 0`.
- **Reachability**: flood-fill / grid walk from bottom-tier spawn to every tier
  and to the top-tier centre succeeds for all seeds in the test suite (no orphan
  tier).
- **Deterministic**: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: profile shape, tier
  count 3–5, monotonic tier Y, ramp count = tiers − 1, slope ≥ 0.2, total Y ≥
  10, full reachability, perimeter walls, and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and branch in `generateLayout()`
    to `generateSpireAscent(seed)` (mirror `generateSunkenCanyon`).
  - Add `SPIRE_ASCENT` tuning constants (tier size, ramp width/depth, min total
    rise ≥ 10, tier-count RNG).
  - Export **`buildAscentRampRoom(opts)`** that wraps or mirrors
    `buildDescentRampRoom`: low Y on the **south** (−Z) / bottom-tier side, high
    Y on the **north** (+Z) / upper-tier side (`axis: 'z'`). Document that
    `buildDescentRampRoom` is the shared geometry primitive; ascent only differs
    in placement order and Y assignment.
  - **`generateSpireAscent(seed)`**:
    - Stack tiers along **+Z** (bottom tier at largest +Z, ramps climb toward
      −Z) or the inverse, but keep a single clear upward path; bottom = spawn,
      top = objective.
    - Place one ramp between each consecutive tier pair at a deterministic X
      offset (single spine path is fine for v1; avoid overlapping ramp AABBs).
    - Distribute tier centre Y so cumulative rise ≥ 10; keep each ramp slope ≥
      0.2 given `rampDepth` / `rampWidth`.
    - Tier walls: four edges per tier with gaps only where the ramp connects
      (reuse `buildHorizontalWallWithGaps` pattern from sunken-canyon).
    - Return `{ rooms, passages: [], passageWidth, cellSpacing, profile:
      'spire-ascent' }` (ramps are rooms, not passages).
  - Export `buildAscentRampRoom` (and keep `buildDescentRampRoom` export) for
    ticket 137 reuse.
- `game/server/simulation.js`: confirm `buildWallColliders` / `computeWalkableAABBs`
  already handle multi-room sloped layouts (no change expected).
- Tests: new `describe("generateLayout(seed, 'spire-ascent')")` block with
  helpers `roomsByBand`, `rampAverageSlope`, `tierCenterYs`, and reachability
  flood-fill (same patterns as sunken-canyon tests).

## Verification: code
