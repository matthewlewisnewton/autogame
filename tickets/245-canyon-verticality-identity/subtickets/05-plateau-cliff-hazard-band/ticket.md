# Optional plateau cliff hazard band

Add a narrow hazard band along the plateau's south (canyon-facing) rim — separate from
descent ramp mouths — so stepping over the void applies light tension without blocking
the main ramp routes.

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon')` emits `layout.edgeHazards` (array) with ≥1 strip
  along the plateau south cliff (high Y), **excluding** ramp gap openings (hazard AABBs
  sit between ramp mouths, not across them).
- `buildDungeon` renders each hazard with the existing emissive edge-strip pattern (may
  share `buildSpireEdgeHazardMesh` or a canyon-tagged variant); mesh count matches hazard
  array length.
- Server movement (`applyPlayerMovement` in `game/server/simulation.js`) applies the same
  class of response as spire edge hazards when `layout.profile === 'sunken-canyon'` and
  the player intersects a hazard AABB: snap toward plateau centre and chip damage on
  cooldown (reuse `SPIRE_EDGE_HAZARD_DAMAGE` / cooldown or add `CANYON_CLIFF_*` constants).
- Hazards are ignored on ramp rooms and in the canyon floor band; walkability regression
  tests remain green.
- Server tests cover hazard presence, ramp-gap clearance, and at least one movement test
  (reposition or damage). Client tests cover hazard mesh emission.

## Technical Specs

- **`game/server/dungeon.js`**
  - Add `buildSunkenCanyonCliffHazards(plateau, rampCenters, rampWidth, yHigh)` returning
    edge-hazard AABBs; attach to layout in `generateSunkenCanyon`.
  - Use `side` metadata (`'south'` or similar) for snap direction toward safe plateau interior.
- **`game/server/simulation.js`**
  - Generalize `findSpireEdgeHazardAt` / `applySpireEdgeHazardResponse` to handle
    `sunken-canyon` (or add parallel `applyCanyonCliffHazardResponse` called from
    `applyPlayerMovement`).
- **`game/client/dungeon.js`**
  - Existing `layout.edgeHazards` loop already renders strips; ensure canyon hazards use
    correct floor Y from `hazard.y`.
- **`game/server/test/dungeon.test.js`** and **`game/server/test/applyPlayerMovement.test.js`**
  - Hazard count, no overlap with ramp centres, movement chip/snap behaviour.
- **`game/client/test/dungeon.test.js`**
  - Hazard meshes for generated sunken-canyon layout.

## Verification: code
