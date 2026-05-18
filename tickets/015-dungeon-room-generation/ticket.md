# Dungeon Room Generation

Replace the single flat floor with a modular, semi-procedurally generated
dungeon of connected rooms — the "Dungeon" stage from `game/docs/design.md`.

## Acceptance Criteria
- The level is built from multiple distinct rooms joined by passages, assembled
  from modular pieces
- Generation is semi-procedural — the layout varies between sessions but is
  always fully traversable
- Walls bound the rooms and passages; players cannot walk out of the level,
  and movement plus camera-follow still work correctly
- All players in a session share the exact same generated layout (the server
  is authoritative — e.g. it picks and broadcasts a seed)

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`
- **Server**: choose a layout seed at session start and include it in the
  `init` payload / state so every client builds an identical level.
- **Client**: build room and wall geometry from the seed/layout; add simple
  collision so players stop at walls. Keep the generator modular so new room
  types can be added later.
