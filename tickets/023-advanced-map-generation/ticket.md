# Advanced Map Generation

Improve the existing procedural dungeon so runs have more variety and readable room roles without changing the basic server-authoritative layout contract.

## Goal

The current dungeon generator creates connected rooms and passages. This ticket should make generated maps feel more like authored game spaces while keeping the implementation simple enough for the harness to verify visually.

## Acceptance Criteria
- Generated layouts include room metadata for at least three room roles:
  - `start`
  - `combat`
  - `treasure`
- Exactly one room is marked `start`.
- At least one room is marked `combat`.
- At least one room is marked `treasure` when the layout has enough rooms.
- Player spawn uses the `start` room.
- Enemies preferentially spawn in `combat` rooms, not in the start room.
- Loot or reward props preferentially spawn in `treasure` rooms.
- The client renders room roles with subtle visual differences, such as floor tint or simple marker props.
- All generated rooms remain reachable from the start room.
- Wall and passage collision remain correct after role metadata is added.
- The layout remains deterministic for a given seed.
- Existing debug scenarios still place players/enemies in valid reachable positions.

## Implementation Notes
- Build on the current `gameState.layout.rooms` structure rather than replacing the generator.
- Suggested room metadata fields:
  - `role`
  - `spawnWeight`
  - `encounterTier`
- Keep the first implementation simple:
  - first room or chosen spawn room: `start`
  - farthest room from start: `treasure`
  - remaining eligible rooms: `combat`
- Prefer helper functions:
  - `assignRoomRoles(layout, rng)`
  - `findFarthestRoom(layout, startRoom)`
  - `roomsByRole(layout, role)`
  - `randomRoomPositionByRole(role)`
- Do not add boss rooms, keys, locked doors, or minimap UI in this ticket.
- Do not change the top-level layout payload shape in a way that breaks existing clients; add fields to room objects.

## Files
- `game/server/index.js`
- `game/client/main.js`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`

## Tests
- Unit test role assignment is deterministic for a fixed seed.
- Unit test exactly one start room exists.
- Unit test start/combat/treasure role constraints.
- Unit test enemy spawn excludes the start room when combat rooms exist.
- Unit test all rooms remain connected after role assignment.
- Integration or screenshot QA verifying role tint/markers render in the dungeon.

## Verification: visual
