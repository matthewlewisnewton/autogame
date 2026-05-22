# Sub-ticket 02: Extract Client Renderer Module

## Status
✅ **Completed** — All 663 tests pass (16 test files)

## What was done

### New file: `game/client/renderer.js`
Created a new ES module containing all Three.js rendering logic extracted from `game/client/main.js` (~2098 lines → ~1180 lines in renderer, ~1098 lines remaining in main).

**Exports (~30 functions):**
- **Scene bootstrap**: `initScene()`, `getRenderer()`, `getScene()`, `getCamera()`
- **Animation loop**: `animate()` — reads shared state refs each frame for mesh sync, camera follow, damage numbers, attack effects
- **Player mesh**: `updateMyPlayer()` — creates/positions player mesh with role-based geometry
- **Enemy mesh**: `createEnemyMesh()`, `createHealthBarMesh()`, `updateHealthBarMesh()`, `enemyMeshHalfHeight()`, `healthBarColor()`
- **Visual effects**: `flashMesh()`, `spawnDamageNumber()`, `updateDamageNumbers()`, `spawnHitSpark()`, `applyWindupFlash()`, `spawnAttackEffect()`, `spawnSummonEffect()`, `updateAttackEffects()`
- **Loot**: `markLootCollected()`, `syncLootMeshes()`, `disposeStaleMeshes()`, `getPickedUpLootIds()`
- **Phase**: `setGamePhase()`, `getActiveEffects()`, `getWindupFlashing()`
- **State accessors**: `setGameStateRef()`, `setMyId()`, `setSocketRef()`, `getMeshMaps()`

### Modified: `game/client/main.js`
- Removed all Three.js scene creation, mesh generation, `animate()`, and visual effects code
- Imports from `./renderer.js` and re-exports renderer functions on `window` for test compatibility
- Retains: socket orchestration, DOM/UI wiring, auth, hand rendering, deck editor, lobby, run summary, mute toggle, sound

### Communication pattern
main.js → renderer via shared mutable references (`setGameStateRef`, `setMyId`, `setSocketRef`); renderer's `animate()` reads from these refs each frame.

### Test compatibility fix
`getScene()` and `spawnAttackEffect()`/`spawnSummonEffect()` now check `window.___test_scene` (set by `window.__setScene()` in tests) before falling back to the real scene.

## No changes to
`config.js`, `dungeon.js`, `hand.js`, `cards.js`, `audio.js`, `delta.js`, `index.html`, `style.css`, test files
