# Center arena dais landmark

Give the open-plaza arena a unmistakable focal point by placing a raised central
dais landmark at the origin. The dais is visual-only (no collision) and uses an
arena-specific material palette so it reads clearly against the flat floor.

## Acceptance Criteria

- `generateLayout(seed, 'open-plaza')` returns a `landmarks` array containing
  exactly one entry at `(x: 0, z: 0)` with `type: 'arena_dais'` (optional `yaw`).
- The dais does not add wall colliders; existing open-plaza reachability,
  spawn-clear, cover, and platform invariants remain unchanged.
- `buildLandmarkMesh('arena_dais', materials)` composes a raised circular/hex
  platform with accent trim (e.g. stacked cylinders/boxes) tall enough to read
  from the perimeter (~0.4–1.0 units above floor).
- `buildDungeon` renders the dais group at `sampleFloorY(layout, 0, 0)` with
  profile materials; children are tracked in `meshes` for disposal.
- `game/shared/dungeonTheme.json` gains an `open-plaza` profile entry (warm stone
  floor/wall + bright accent) and `resolveProfileKey('open-plaza')` resolves it.
- Server and client vitest cover landmark presence, allowed type, mesh group
  child count, and that `buildWallColliders` is unchanged by the landmark.

## Technical Specs

- **`game/server/dungeon.js`**
  - In `generateOpenPlaza(seed)`, set `layout.landmarks = [{ x: 0, z: 0, type: 'arena_dais' }]`.
  - Do not shrink `OPEN_PLAZA.spawnClearRadius` or move cover placement logic.
- **`game/shared/dungeonTheme.json`**
  - Add `"open-plaza"` palette (arena stone floor/wall, gold or amber accent).
- **`game/client/dungeon.js`**
  - Extend `buildLandmarkMesh` with an `arena_dais` case (low pedestal + accent ring).
  - Existing `layout.landmarks` loop already positions groups — no new collision path.
- **`game/server/test/dungeon.test.js`**
  - Under the `open-plaza` describe block: assert `landmarks` length/type/position.
- **`game/client/test/dungeon.test.js`**
  - Assert `buildLandmarkMesh('arena_dais', …)` returns a group with geometry children
    and that `buildDungeon` on an open-plaza layout emits one landmark group.

## Verification: code
