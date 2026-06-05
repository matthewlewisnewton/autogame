# Doorway markers in large rooms

Add emissive doorway markers at passage connections in large rooms so players can spot exits in spacious `open` layouts (and any other profile with oversized rooms).

## Acceptance Criteria

- For each room where `Math.min(room.width, room.depth) >= 16`, `buildDungeon` places a visible marker mesh at every passage doorway gap on that room's perimeter (aligned to the wall opening centre, sitting on the floor via `sampleFloorY`).
- Markers are not placed in small rooms (below the size threshold) or on solid wall segments without a gap.
- Marker geometry is distinct from cover/landmarks (e.g., low emissive arch or floor stripe) and uses the active profile's accent tint.
- Markers are added to the returned `meshes` array and disposed by `clearDungeon` like other dungeon geometry.
- Vitest on a synthetic large-room layout with two passage gaps asserts exactly two doorway marker meshes are created; a small-room control layout creates none.

## Technical Specs

- `game/client/dungeon.js`:
  - Add `LARGE_ROOM_MIN_SIZE = 16` constant and `buildDoorwayMarkers(room, layout, materials)` helper.
  - Derive gap centres from the room's `walls` array: consecutive wall segments on the same edge imply a doorway at the missing span; cross-reference `layout.passages` connected to the room centre `(room.x, room.z)` to confirm passage width.
  - Marker mesh: e.g., `BoxGeometry(passageWidth * 0.8, 0.15, 0.4)` or a thin `TorusGeometry` arch with `emissive` material; position at gap centre, Y from `resolveFloorY(sampleFloorY(layout, x, z))`.
  - Call from `buildDungeon` room loop after walls, before cover/landmarks.
  - Export `buildDoorwayMarkers` for unit tests.
- `game/client/test/dungeon.test.js`: tests for marker count on large vs small synthetic layouts.

## Verification: code
