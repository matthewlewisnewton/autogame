# Server: fire-cavern layout generation

Add a `fire-cavern` stage profile to `generateLayout()` that produces a volcanic
caldera: a high **rim** spawn band overlooking a large lower **basin** floor,
connected by 2–3 sloped ramp rooms. Mirror the sunken-canyon vertical structure
(rim ≈ plateau, basin ≈ canyon) with fire-themed `band` tags. No slippery-floor
physics — only geometry and walkability.

## Acceptance Criteria

- `generateLayout(seed, 'fire-cavern')` returns a layout with `profile:
  'fire-cavern'`.
- Exactly **two elevation bands** are identifiable in `layout.rooms`:
  - **Rim** (`band: 'rim'`): one room-sized walkable area (~12–15 units wide/deep)
    with uniform `floorCorners` at the high band Y.
  - **Basin** (`band: 'basin'`): one walkable area with width × depth ≥ 4 × a
    default room (≥ 728 units²).
- **2–3 ramp rooms** (`band: 'ramp'`) connect rim → basin. Each ramp has
  non-uniform `floorCorners` (high edge on the rim side, low edge on the basin
  side), average slope ≥ 0.15, and bridges the Y gap continuously.
- Rim center Y minus basin center Y ≥ 8 units (measured via `sampleFloorY` at room
  centers).
- Both bands have **solid perimeter walls**; ramp mouths align with rim/basin edges
  so the full route is walkable with no exterior walk-off gaps.
- Roles are assigned explicitly: rim = `start`, basin = `treasure`, ramps =
  `connector` with `spawnWeight: 0`.
- Layout includes `layout.cover` on the basin floor (≥ 6 pieces, same shape rules
  as sunken-canyon / open-plaza).
- **Deterministic**: two calls with the same seed produce deep-equal layouts.
- Unit tests in `game/server/test/dungeon.test.js` cover: profile shape, two
  bands, ramp count 2–3, Y drop ≥ 8, ramp slope ≥ 0.15, determinism.
- Walkability test in `game/server/test/fire_cavern_walkability.test.js` confirms
  foot reachability from rim spawn to basin center via ramps only (flood using
  `computeWalkableAABBs` + wall colliders, same pattern as
  `sunken_canyon_walkability.test.js`).

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'fire-cavern'` to `LAYOUT_PROFILES` and branch in `generateLayout()` to
    `generateFireCavern(seed, options)` (mirror `generateSunkenCanyon`).
  - Add `FIRE_CAVERN` constants (reuse sunken-canyon sizing where sensible:
    rim/basin sizes, ramp width/depth, `yDrop`, spawn clear, interior margin).
  - **`generateFireCavern(seed, options)`**:
    - Rim at negative Z (north overlook), basin centred below, Y stepping down
      rim → basin (reuse `buildDescentRampRoom` with `axis: 'z'`).
    - Place 2–3 ramp rooms at distinct X offsets so paths do not overlap.
    - Basin room: flat `floorCorners` at low Y; scatter cover via
      `scatterCoverInArena` / `placeCoverInArenaOrdered` (lift from open-plaza).
    - Tag rooms with `band: 'rim' | 'ramp' | 'basin'` and explicit roles as above.
    - Return `{ rooms, passages: [], cover, passageWidth, cellSpacing, profile:
      'fire-cavern' }`.
  - Export `generateFireCavern` from `module.exports` for tests.
- `game/server/simulation.js`: no change expected — confirm rim/basin `walls` and
  `layout.cover` feed `buildWallColliders` like sunken-canyon.
- Tests: new `describe("generateLayout(seed, 'fire-cavern')")` block in
  `game/server/test/dungeon.test.js`; new
  `game/server/test/fire_cavern_walkability.test.js`.

## Verification: code
