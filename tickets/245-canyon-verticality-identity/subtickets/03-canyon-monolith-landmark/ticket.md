# Canyon-floor monolith landmark

Place a tall, readable monolith prop on the sunken canyon floor as a navigation landmark
distinct from the gold treasure-room pillar.

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon')` includes exactly **one** landmark in the canyon
  band: `{ type: 'canyon_monolith', x, z, yaw }`, placed inside the canyon room interior,
  outside the spawn-clear radius, and not overlapping cover footprints.
- The monolith position is deterministic for a fixed seed across two layout generations.
- `buildLandmarkMesh('canyon_monolith', …)` composes a tall stone-like prop (≥ 2.5 units
  visual height) using profile wall/accent materials; `userData.landmarkType ===
  'canyon_monolith'`.
- `buildDungeon` adds the landmark group at `sampleFloorY(layout, x, z)`; landmarks remain
  visual-only (no extra wall colliders).
- The existing gold treasure marker on the treasure (`canyon`) room remains unchanged.
- Server and client tests cover presence, type, and floor Y placement for seed `42`.

## Technical Specs

- **`game/server/dungeon.js`**
  - Add `canyon_monolith` to landmark footprints; implement `placeCanyonMonolith(layout,
    rng)` called from `generateSunkenCanyon` (reuse `acceptsLandmarkCandidate` / blocked
    list from cover + spawn clear).
  - Set `layout.landmarks = [monolith]` (do not route through `LANDMARK_TYPES` crowded/open).
- **`game/client/dungeon.js`**
  - Add `case 'canyon_monolith':` in `buildLandmarkMesh` (stacked boxes/cylinders, muted
    stone colors from `materials.wall` / `materials.accent`).
- **`game/server/test/dungeon.test.js`**
  - Assert one `canyon_monolith` in canyon band, clear of cover, deterministic coords.
- **`game/client/test/dungeon.test.js`**
  - Assert one landmark group with `landmarkType === 'canyon_monolith'` for generated layout.

## Verification: code
