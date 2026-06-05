# Center ring floor markings

Add a painted center-ring floor marking on the open-plaza arena so players can
orient toward the duel focal point without adding collision or changing spawn
logic.

## Acceptance Criteria

- `generateLayout(seed, 'open-plaza')` returns a `floorMarkings` array with at
  least one `{ type: 'center_ring', x: 0, z: 0, innerRadius, outerRadius }`
  entry whose annulus lies inside the spawn-clear radius (≤ 6 units from origin).
- Floor markings are visual-only: they do not appear in `buildWallColliders` and
  do not affect `sampleFloorY` or player movement.
- `buildDungeon` renders each floor marking as a thin accent-colored mesh flush
  with the plaza floor (e.g. `RingGeometry` or paired cylinders) at
  `sampleFloorY(layout, x, z)`.
- Marking meshes are pushed into the returned `meshes` array for cleanup.
- Non–`open-plaza` layouts without `floorMarkings` render unchanged.
- Vitest asserts `floorMarkings` shape on open-plaza layouts and that
  `buildDungeon` emits one ring mesh per marking with accent material.

## Technical Specs

- **`game/server/dungeon.js`**
  - In `generateOpenPlaza(seed)`, set `floorMarkings` with a deterministic
    center ring (e.g. `innerRadius: 3.5`, `outerRadius: 4.5`).
- **`game/client/dungeon.js`**
  - Add `buildFloorMarkingMesh(marking, materials)` (handle `center_ring` via
    `THREE.RingGeometry` rotated flat, or thin `TorusGeometry`).
  - In `buildDungeon`, after room floors and before cover, iterate
    `layout.floorMarkings || []`, position at floor Y, push meshes.
  - Export `buildFloorMarkingMesh` for tests.
- **`game/server/test/dungeon.test.js`**
  - Assert `floorMarkings` presence, `center_ring` type, and radii bounds.
- **`game/client/test/dungeon.test.js`**
  - Synthetic open-plaza layout with one `floorMarkings` entry; assert mesh count
    and that ring mesh uses accent material / lies near `DEFAULT_FLOOR_Y`.

## Verification: code
