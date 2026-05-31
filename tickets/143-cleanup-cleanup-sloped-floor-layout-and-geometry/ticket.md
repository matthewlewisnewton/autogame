# Cleanup nits from 142-cleanup-sloped-floor-layout-and-geometry

> **Staleness note.** This follow-up ticket was written against commit
> `21eaa56` (2026-05-31). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `142-cleanup-sloped-floor-layout-and-geometry`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Passage walls still use flat FLOOR_Y
Room walls on slopes now follow `sampleFloorY()`, but passage side walls in `buildDungeon()` still position at `PASSAGE_WALL_HEIGHT / 2 + FLOOR_Y`. Doorway segments on sloped room connections may show a small vertical mismatch until passage walls sample the floor too.
### Acceptance Criteria
- Passage wall meshes in `game/client/dungeon.js` use `sampleFloorY()` at each wall `(x, z)` (or a documented flat-corridor approximation), with a unit test mirroring the room-wall assertion.
