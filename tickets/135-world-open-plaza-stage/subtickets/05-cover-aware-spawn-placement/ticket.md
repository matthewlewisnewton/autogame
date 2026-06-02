# Cover-Aware Enemy / Loot / Objective Placement on the One-Room Plaza

On the open-plaza stage there is a single `start` room and no combat/treasure
rooms, so every spawn path falls back to a plain "random point in the room"
helper (`randomRoomPosition`, `randomRoomPositionByRole`, `randomPositionInRoom`,
and the inline samplers in `spawnCrystals`/`spawnLoot`). None of these reject the
`layout.cover` footprints, so enemies, loot, and collectible objectives can spawn
**inside a cover piece** — stuck inside a solid pillar/wall. Make the plaza
fallback placement cover-aware so no spawned entity lands inside cover.

## Acceptance Criteria

- A shared cover-aware position helper rejects (or nudges out of) any point that
  falls inside a `layout.cover` footprint (footprint inflated by a small entity
  radius), and is used by the one-room plaza fallback paths for **enemies, loot,
  and collectible/item objectives (crystals)**.
- On an `open-plaza` layout, enemy spawns produced by `spawnCombatEnemies()` /
  `pickEnemySpawnPosition()` never overlap any cover AABB.
- On an `open-plaza` layout, loot (`spawnLoot`) and crystal/item objectives
  (`spawnCrystals`) never overlap any cover AABB.
- Every produced position is still inside the plaza floor (within the room minus
  spawn padding) and outside the perimeter walls.
- Layouts **without** a `cover` array are unaffected — the existing
  rooms-and-passages placement behaves exactly as before (no cover ⇒ no-op).
- Determinism is preserved for the seeded helpers (`randomRoomPositionByRole`,
  `spawnCrystals`): same seed/layout → same positions.
- Unit tests cover: generated open-plaza enemy positions are all clear of cover,
  generated crystal/loot positions are all clear of cover, and a cover-free
  layout still places entities normally.

## Technical Specs

- Add one reusable helper (e.g. `isInsideCover(x, z, layout, pad)` and/or a
  `randomRoomPositionClearOfCover(room, layout, rng)`), placed where the other
  spawn helpers live. It must treat each `layout.cover` piece's footprint
  (inflated by ~`PLAYER_RADIUS`) as forbidden and resample (bounded attempts)
  before falling back to nudging the point outward to the nearest clear floor.
  Note: `game/server/simulation.js` already has a private `nudgeClearOfCover()` —
  prefer exporting/reusing that logic rather than duplicating it.
- `game/server/dungeon.js`: make `randomRoomPositionByRole()` cover-aware when the
  layout carries `cover` (skip points inside cover; keep current behavior when
  there is no cover). Export any new helper as needed.
- `game/server/simulation.js`: make `randomRoomPosition()` cover-aware (it is the
  final fallback hit by the plaza). Export `nudgeClearOfCover` (or the new
  helper) if `progression.js` needs it.
- `game/server/progression.js`: route the plaza fallbacks through the cover-aware
  helper — in `pickEnemySpawnPosition()` (the `randomRoomPosition()` /
  `randomPositionInRoom()` branches), `spawnLoot()`, and `spawnCrystals()` (and
  `randomPositionInRoom()` itself). Keep non-plaza behavior unchanged.
- `game/server/test/`: add tests (in `progression`/`dungeon`/`simulation` test
  files as appropriate) that build an `open-plaza` layout, run the spawn paths,
  and assert no produced position lies inside any cover AABB, plus a regression
  test that a cover-free layout still spawns normally.

## Verification: code
