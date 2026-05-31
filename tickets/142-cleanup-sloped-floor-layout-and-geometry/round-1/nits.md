## Passage walls still use flat FLOOR_Y
Room walls on slopes now follow `sampleFloorY()`, but passage side walls in `buildDungeon()` still position at `PASSAGE_WALL_HEIGHT / 2 + FLOOR_Y`. Doorway segments on sloped room connections may show a small vertical mismatch until passage walls sample the floor too.
### Acceptance Criteria
- Passage wall meshes in `game/client/dungeon.js` use `sampleFloorY()` at each wall `(x, z)` (or a documented flat-corridor approximation), with a unit test mirroring the room-wall assertion.
