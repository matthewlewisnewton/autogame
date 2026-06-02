# Cover-aware enemy / objective / loot spawning on open-plaza

When an open-plaza (`arena_trials`) run is generated, the layout has only a
`start` room and no `combat`/`treasure` rooms, so enemy, crystal/objective, and
loot placement falls through to the legacy `randomRoomPosition()` /
`randomPositionInRoom()` paths. Those paths use unseeded `Math.random()` and do
not reject positions that overlap solid cover (pillars / broken walls) or outer
walls, so entities can spawn inside cover and the defeat/collect objective
becomes unreliable. Add a seeded, cover-aware spawn helper for the
single-room / no-role fallback and route enemy, objective, and loot placement
through it.

## Acceptance Criteria

- A new seeded spawn-position helper exists (e.g. `pickFloorSpawnPosition(layout, rng)`)
  that samples positions inside the walkable plaza and **rejects** any candidate
  that collides with a cover piece or wall, retrying up to a bounded number of
  attempts before falling back to a known-safe point (e.g. near the plaza
  center / start-room spawn-clear zone).
- The helper uses the passed-in seeded `rng` only — no `Math.random()` — so
  spawn placement is deterministic for a given layout seed.
- Collision rejection reuses the existing collider set that already includes
  open-plaza cover footprints (`getWallColliders()` / `checkWallCollision()` in
  `game/server/simulation.js`), so a rejected candidate is one that would
  overlap a pillar, broken wall, or perimeter wall.
- Enemy spawning (`pickEnemySpawnPosition` / `spawnCombatEnemies`), objective
  item spawning (crystals / `collect_items`), and incidental loot
  (`spawnLoot`) all use the cover-aware helper when the layout has no
  `combat`/`treasure` rooms (the open-plaza case), instead of
  `randomRoomPosition()` or unguarded `randomPositionInRoom()`.
- Loot spawning no longer uses unseeded `Math.random()` for the open-plaza
  fallback position (the seeded rng is threaded through).
- Existing rooms-and-passages stages are unaffected: when `combat`/`treasure`
  rooms exist, placement behaves exactly as before.
- A new `arena_trials` test proves that every spawned enemy, objective item,
  and loot drop on the open-plaza stage sits on walkable floor and does not
  overlap any cover piece or wall collider, and that the same seed yields the
  same spawn positions.

## Technical Specs

- `game/server/simulation.js`: add the cover-aware seeded helper (e.g.
  `pickFloorSpawnPosition(layout, rng, { maxAttempts })`). Sample within the
  plaza floor bounds (use the plaza room / `walkableAABBs` / `dungeonBounds`),
  reject candidates via `checkWallCollision(x, z, getWallColliders())` (the
  collider set already includes `layout.cover` footprints — see
  `buildWallColliders`), and fall back to a safe start-room-relative point
  after `maxAttempts`. Export it alongside `randomRoomPosition`.
- `game/server/progression.js`: in `pickEnemySpawnPosition`, replace the final
  `randomRoomPosition()` fallback (and the unguarded `nonStartRooms` path when
  there are no combat rooms) with the cover-aware helper for the open-plaza /
  no-role case. In `spawnLoot`, thread the seeded `rng` through and replace the
  `randomRoomPosition()` / `Math.random()` fallback with the cover-aware helper.
  Ensure crystal/objective placement (`spawnCrystals` for `collect_items`) also
  routes through the helper when no treasure/combat rooms exist.
- Keep the existing room-based branches intact for normal stages; only the
  open-plaza (single `start` room, no role rooms) path changes.
- Add the test under the existing server test location (e.g.
  `game/server/__tests__/` or wherever `arena_trials` / open-plaza tests live):
  generate an `open-plaza` layout with a fixed seed, run the spawn path, and
  assert each enemy/objective/loot position is inside the plaza and not
  colliding with any cover or wall, plus determinism across two runs of the
  same seed.

## Verification: code
