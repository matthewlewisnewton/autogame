# Gate enemy target acquisition on line-of-sight (no aggro through walls)

Enemy target acquisition is a pure 2D radius check (`game/server/simulation.js`, the
`updateEnemies` loop ~lines 2930-2994): any player within `DETECTION_RADIUS = 8` is
acquired and chased even when a solid wall sits between them. This lets enemies in the
ice-cavern connectors aggro a player standing in the frost_crossing start room *through
the wall* and swarm the spawn room within seconds. Add a line-of-sight gate so an enemy
only acquires/chases a target it can actually see, using the wall colliders that already
exist for movement.

## Acceptance Criteria

- A new line-of-sight helper exists in `game/server/simulation.js` (e.g.
  `hasLineOfSight(x1, z1, x2, z2, colliders = getWallColliders())`) that returns `false`
  when the straight segment between the two points crosses any wall collider AABB, and
  `true` otherwise. It is exported from the module.
- In the `updateEnemies` loop, an enemy does NOT acquire or chase a player when a wall
  blocks the line between them, even if that player is within `DETECTION_RADIUS`. The
  per-player acquisition loop (~lines 2960-2971) skips players with no line-of-sight.
- The same line-of-sight gate is applied to the enemy's acquisition of friendly minions
  and taunt minions in that loop (the `findTauntMinionNear` / `findNearestMinionNear`
  results ~lines 2931 and 2952) so enemies cannot lock onto minions through walls either.
- When there IS a clear (wall-free) line between an enemy and a player within
  `DETECTION_RADIUS`, the enemy still transitions to `'chasing'` exactly as before — the
  fix must not break normal aggro in open rooms or through doorway gaps (doorway openings
  are gaps between wall colliders, so a segment through a doorway must pass the LOS test).
- An enemy that loses line-of-sight to its only target (e.g. the player steps behind a
  wall) reverts to `'idle'`/wander on subsequent ticks instead of continuing to chase
  through the wall.
- New server tests in `game/server/test/enemy_line_of_sight.test.js` cover, at minimum:
  (a) enemy ~6 units from a player with a wall collider between them stays `idle` and does
  NOT enter `'chasing'` after `updateEnemies()`; (b) enemy ~6 units from a player with no
  wall between them enters `'chasing'`; (c) a player visible through a doorway gap (no
  collider on the direct line) is still acquired.
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- `game/server/simulation.js`:
  - Add `hasLineOfSight(x1, z1, x2, z2, colliders = getWallColliders())`. Implement it by
    iterating `colliders` and returning `false` on the first `segmentIntersectsAABB(x1, z1,
    x2, z2, aabb)` hit; otherwise `true`. Reuse the existing `segmentIntersectsAABB`
    (defined ~line 754) and `getWallColliders()` — do not write a new geometry routine.
  - In `updateEnemies` (~lines 2819+):
    - Player acquisition loop (~2960-2971): after the `dist < DETECTION_RADIUS && dist <
      nearestDist` check, also require `hasLineOfSight(enemy.x, enemy.z, player.x,
      player.z)` before treating the player as a candidate target.
    - Taunt minion (`tauntMinion`, ~2931-2941): only chase/attack it when
      `hasLineOfSight(enemy.x, enemy.z, tauntMinion.x, tauntMinion.z)` is true.
    - Friendly minion (`nearestMinion`, ~2952-2957): only adopt it as `nearestTarget` when
      `hasLineOfSight(enemy.x, enemy.z, nearestMinion.minion.x, nearestMinion.minion.z)` is
      true.
  - Compute the colliders once per tick (call `getWallColliders()` ahead of the enemy loop
    or rely on the default arg) — avoid rebuilding colliders per enemy/per target.
  - Export `hasLineOfSight` in `module.exports` (~line 3626) so tests can call it directly.
  - Do NOT change the player-side minion-vs-enemy targeting blocks (~lines 3150-3510); this
    ticket only fixes enemies acquiring players/minions through walls. Leave
    `DETECTION_RADIUS` (`game/server/config.js`) unchanged.
- `game/server/test/enemy_line_of_sight.test.js` (new): require `simulation.js`, build a
  minimal `gameState` via `setGameState`, install a wall collider between an enemy and a
  player (use `buildWallColliders` with a hand-built layout, or set colliders so
  `getWallColliders()` returns an AABB straddling the segment), call `updateEnemies()`, and
  assert `enemy.state`. Follow the require/setup pattern in an existing enemy test such as
  `game/server/test/ice_enemy.test.js`.

## Verification: code
