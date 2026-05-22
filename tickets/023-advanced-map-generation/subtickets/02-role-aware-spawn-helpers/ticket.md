# Role-Aware Spawn Helpers

Add query and helper functions for spawning entities in rooms by their assigned role. These functions are pure utilities operating on the layout data structure.

## Acceptance Criteria
- `roomsByRole(layout, role)` returns an array of rooms matching the given role string.
- `randomRoomPositionByRole(layout, role, rng)` returns a random position `{x, z}` within a room of the specified role.
- When no rooms match the requested role, `randomRoomPositionByRole` falls back to a random position in any room.
- Helpers are deterministic when passed a seeded RNG (Mulberry32).
- All functions are exported from `dungeon.js`.

## Technical Specs
- **File:** `game/server/dungeon.js`
  - Add `roomsByRole(layout, role)` — filters `layout.rooms` by `room.role === role`.
  - Add `randomRoomPositionByRole(layout, role, rng)` — picks a random room from `roomsByRole(layout, role)`, then returns a random position within that room's bounds (using `SPAWN_PADDING = 2`), matching the logic of the existing `randomRoomPosition()` but scoped to a role.
  - If `roomsByRole` returns empty, fall back to picking any room from `layout.rooms`.
  - Export `roomsByRole`, `randomRoomPositionByRole`.
- **File:** `game/server/index.js` — import new helpers from `dungeon.js` (used in next sub-ticket).

## Verification: code
