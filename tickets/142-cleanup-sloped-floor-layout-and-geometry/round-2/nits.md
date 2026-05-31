## Passage walls still use flat FLOOR_Y

Room walls on slopes now follow `sampleFloorY()`, but passage side walls in `buildDungeon()` still position at `PASSAGE_WALL_HEIGHT / 2 + FLOOR_Y`. Doorway segments on sloped room connections may show a small vertical mismatch until passage walls sample the floor too.
### Acceptance Criteria
- Passage wall meshes in `game/client/dungeon.js` use `sampleFloorY()` at each wall `(x, z)` (or a documented flat-corridor approximation).
- Unit test or screenshot on a layout with a sloped room adjacent to a passage shows no obvious wall-base gap at the junction.

## Harden createLobby for resumed capture sessions

Round-2 showed `#create-lobby-name` in DOM but not visible when the lobby browser panel was hidden after a partial capture retry. A small guard in the harness would reduce flake on re-runs without changing game code.
### Acceptance Criteria
- `harness/screenshot.mjs` `createLobby` succeeds when the player is already in squad lobby (`#lobby` visible) without filling the create form.
- Re-running capture twice in a row on the same dev data directory produces `"ok": true` without manual cleanup.
