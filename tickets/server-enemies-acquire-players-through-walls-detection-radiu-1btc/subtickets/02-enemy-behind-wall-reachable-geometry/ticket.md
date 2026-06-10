# Place the `enemy-behind-wall` debug scenario in normally-reachable walkable space

The `?debugScenario=enemy-behind-wall` setup in `game/server/debugScenarios.js` picks the
*longest* perimeter wall of the Frost Crossing start room. For that layout the longest wall
is the exterior north perimeter wall, so the scenario drops the enemy (and pushes the player)
into the void outside the walkable room/passage layout. That validates an artificial
"enemy in the void" case instead of a normally reachable enemy-behind-a-wall case. Re-anchor
the scenario on a real interior/connector wall so both the player and the enemy sit in
walkable gameplay space while a solid wall still blocks line-of-sight between them.

## Acceptance Criteria

- After running the `enemy-behind-wall` scenario on Frost Crossing, BOTH the player and the
  spawned grunt are inside the walkable layout — i.e. each `(x, z)` falls inside one of the
  AABBs returned by `computeWalkableAABBs(state.layout)` (rooms ∪ passages). Neither entity
  is placed on the exterior/void side of a perimeter wall.
- The two entities remain within `DETECTION_RADIUS` (8) of each other (the existing ~4-units-
  apart offset is fine) and a solid wall still sits on the straight segment between them, so
  `hasLineOfSight(enemy.x, enemy.z, player.x, player.z, colliders)` returns `false`.
- The wall chosen is a real interior boundary that has walkable space on the player's side AND
  the enemy's side (e.g. the wall segment the start room shares with an adjacent room or a
  connecting passage), NOT simply the longest segment. A doorway gap on that edge must not lie
  on the player→enemy segment (LOS must stay blocked).
- The enemy still spawns as a `grunt`, starts `idle`/`idle`, and after several `updateEnemies()`
  ticks stays `idle` (does not aggro through the wall) — the behaviour the scenario exists to
  demonstrate is unchanged.
- `game/server/test/debug-scenarios.test.js` is updated so the `enemy-behind-wall` test asserts
  both entities lie inside `computeWalkableAABBs(state.layout)` (walkable space) in addition to
  the existing dist < 8, `hasLineOfSight(...) === false`, and "stays idle after ticks" checks.
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- `game/server/debugScenarios.js`, the `if (name === 'enemy-behind-wall')` branch (~line 1296):
  - Replace the "longest wall" selection (`[...room.walls].sort((a, b) => b.length - a.length)[0]`)
    with logic that picks an *interior* start-room wall that has walkable space on both sides.
    Reuse the already-imported `computeWalkableAABBs` (from `./simulation`): compute the walkable
    AABBs once, then for each candidate start-room wall compute the prospective player point and
    enemy point (wall coord ± `offset` along the wall normal, as the current code already does for
    `axis === 'z'` / `axis === 'x'`) and choose the first wall where BOTH points fall inside some
    walkable AABB. Keep the existing `offset = 2` (≈4 units apart, < `DETECTION_RADIUS`).
  - Skip walls whose chosen segment point coincides with a doorway gap, so the wall on the
    player→enemy segment stays solid and `hasLineOfSight` returns `false`. (A simple guard: after
    selecting, verify the segment is wall-occluded — if you have access to `getWallColliders()` /
    `hasLineOfSight` here, assert LOS is blocked; otherwise pick the wall whose midpoint is a solid
    segment, not one of the two short doorway-flanking segments.)
  - Leave the rest of the branch unchanged: `setupFrostCrossingTier1Deploy(...)`, clearing
    `state.enemies`, `spawnEnemy(enemyX, enemyZ, 'grunt')`, setting `wanderTarget`/`state`/
    `attackState` to idle, floor-Y resolution via `resolveFloorY(sampleFloorY(...))`, the
    `emitLobbyQuestUpdate` / `broadcastLobbyUpdate` / `STATE_UPDATE` emits, and the
    `{ ok: true, scenario: name }` return.
  - Update the branch's leading comment to reflect that it now anchors on a real interior/connector
    wall with walkable space on both sides.
- `game/server/test/debug-scenarios.test.js`, the `describe('debugScenario — enemy-behind-wall', …)`
  block (~line 1851): after fetching `enemy` and `player`, add assertions that each `(x, z)` is
  inside `computeWalkableAABBs(state.layout)` (import/require it the same way `buildWallColliders`
  and `hasLineOfSight` are already pulled in). Keep the existing `dist < 8`,
  `hasLineOfSight(...) === false`, and post-tick `enemy.state === 'idle'` assertions.
- Do NOT touch sub-ticket `01`'s shipped `hasLineOfSight` / `updateEnemies` production logic, the
  `DETECTION_RADIUS` config, or any other debug scenario. Scope is the `enemy-behind-wall` branch
  geometry and its test only.

## Verification: code
