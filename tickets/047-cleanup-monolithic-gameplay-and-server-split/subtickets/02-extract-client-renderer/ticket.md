# Extract Client Renderer Module

Move the Three.js rendering layer, visual effects, health bars, damage numbers, loot meshes, camera follow, and the `animate()` game loop out of `game/client/main.js` into a dedicated `game/client/renderer.js` module.

## Acceptance Criteria

- `game/client/renderer.js` exists and exports:
  - `initScene(layout, spawnPos)` — creates scene, camera, renderer, lights, builds dungeon geometry, starts `requestAnimationFrame(animate)`
  - `animate()` — the per-frame game loop: delta clamping, player movement input, mesh sync (players, enemies, minions, loot), camera follow, effect updates, `renderer.render()`
  - `updateMyPlayer(delta)` — reads WASD keys, normalizes direction, applies movement speed, resolves wall collision, emits `move`
  - `flashMesh(mesh, color, durationMs)` — emissive flash helper
  - `spawnDamageNumber(x, y, z, amount, color, positive)` — creates a fixed-position HTML div, pushes to internal array
  - `updateDamageNumbers()` — projects 3D to screen, floats upward, fades, removes expired
  - `createEnemyMesh(type)` — returns Three.js mesh from `ENEMY_GEOMETRY` table
  - `createHealthBarMesh(enemyId, x, z, type)` — creates box geometry health bar above enemy
  - `updateHealthBarMesh(enemyId, enemy)` — scales x and sets color from HP ratio
  - `applyWindupFlash(enemyId, isWindup)` — sets emissive red on entering windup
  - `spawnAttackEffect(origin, direction)` — creates yellow sphere projectile
  - `spawnSummonEffect(origin, radius)` — creates expanding ring on ground
  - `spawnHitSpark(position)` — creates icosahedron spark at enemy position
  - `updateAttackEffects()` — per-frame: move projectiles, expand/fade summon rings, scale/fade sparks, dispose expired
  - `markLootCollected(lootId, value)` — animates loot collection
  - `syncLootMeshes(currentLoot)` — adds new loot meshes, triggers collection for removed loot
  - `disposeStaleMeshes(map, currentIds)` — removes meshes whose IDs are no longer valid
  - `setGamePhase(phase)` — tells renderer the current phase (for visibility toggles)
  - `getRenderer()` / `getScene()` / `getCamera()` — accessors for test injection
  - `getMeshMaps()` — returns `{ playersMeshes, enemiesMeshes, enemyHealthBars, telegraphMeshes, minionsMeshes, lootMeshes }` for test harness
- `game/client/main.js` no longer contains Three.js scene creation, mesh generation, `animate()`, or visual effect code
- `main.js` calls `initScene()` from renderer when entering playing phase; passes layout and spawn position
- `main.js` calls `setGamePhase()` and mesh-sync helpers from renderer when receiving `stateUpdate`
- All existing client unit tests pass (`npm test` in `game/client/`)
- Visual behavior is unchanged: enemies render, health bars update, damage numbers float, loot bobs, camera follows player

## Technical Specs

- **New file:** `game/client/renderer.js` — ES module containing all Three.js rendering logic currently scattered across `main.js` (lines ~608-625 variable decls, ~1034-1060 flashMesh, ~1077-1170 damage numbers, ~1172-1222 enemy meshes, ~1224-1282 health bars, ~1284-1366 attack effects, ~1368-1412 disposal helpers, ~1414-1610 loot sync, ~1694-1734 updateMyPlayer, ~1736-2040 animate loop, ~2042-2108 initScene)
- **Modify:** `game/client/main.js` — remove all Three.js rendering code; import renderer functions; call `initScene()` from `startGame` and `init` handlers; call `setGamePhase()` on phase changes; keep socket orchestration, DOM/UI, auth, hand rendering, deck editor, card input, lobby wiring, run summary, mute toggle
- **Dependencies:** Three.js, Socket.IO client (for `move` emit inside `updateMyPlayer`), `./config.js` constants, `./dungeon.js` (buildDungeon, buildWallColliders, resolveWallCollision), `./hand.js` (for hand state access in animate loop)
- **Communication pattern:** `main.js` passes game state snapshots to renderer functions; renderer returns nothing (side-effects on scene/DOM). The `animate()` loop in renderer reads from a shared `gameState` reference that `main.js` updates on `stateUpdate`
- **No changes** to `game/client/config.js`, `game/client/dungeon.js`, `index.html`, or `style.css`

## Verification: code
