# Unit test for client spawn role lookup

Add client-side unit tests asserting that `buildDungeon()` selects a spawn position from the room with `role === 'start'` and falls back to `rooms[0]` when no start role exists. Server-side role/spawn tests already exist; this locks the client contract.

## Acceptance Criteria
- A vitest case builds a minimal layout with `start` on a **non-zero** room index and asserts `spawnPosition` matches that room's center.
- A second case with **no** `start` role asserts fallback to `rooms[0]`'s center.
- Tests are placed in `game/client/test/dungeon.test.js` (or an existing dungeon test file if one already exists).
- All existing tests continue to pass.

## Technical Specs
- **File**: `game/client/test/dungeon.test.js` (new) or existing test file
  - Import `buildDungeon` from `../dungeon.js`
  - Construct minimal mock `layout` objects with `rooms` array; each room needs at minimum the shape/position fields `buildDungeon` reads to compute centers
  - Pass a minimal Three.js `Scene` (or mock the scene additions — `buildDungeon` adds meshes to scene, but the test only needs to assert the returned `spawnPosition`)
  - Assert `spawnPosition.x` and `spawnPosition.z` match expected room center coordinates

## Verification: code
