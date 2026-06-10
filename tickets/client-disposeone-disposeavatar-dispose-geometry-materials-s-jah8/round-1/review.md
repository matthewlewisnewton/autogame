# Senior Review

## Runtime health

The captured game run is healthy. `metrics.json` reports `"ok": true`, includes live lobby and dungeon probes with `sceneInitialized: true`, `hasCanvas: true`, connected socket state, two players, enemies, movement, and dodge cooldown state. `pageerrors` is empty, and `console.log` contains no `pageerror` or `[fatal]` lines from game code. The screenshots show the lobby and in-run scene rendering.

## Acceptance criteria

### Despawning one modeled entity does not dispose geometry/materials used by the model cache or other live instances

The enemy/model-cache half is implemented correctly. `loadModel()` now tags geometries and materials on each returned glTF clone with `__modelCacheShared`, and `disposeOne()` routes every traversed mesh through `disposeMeshGpuResources()`, which skips cache-shared geometry/materials. The new `model-dispose.test.js` covers two live modeled enemies sharing the same fake glTF resources and verifies disposing one does not call `dispose()` on the shared geometry/material and leaves the survivor referencing those resources.

### Cosmetic preview tweaks do not re-upload shared buffers

The shared-buffer part is protected, but the avatar/cosmetic path has a blocking disposal bug. `retargetPlayerBodyMesh()` clones the loaded player material after `loadModel()` has marked the source material as cache-shared. In real Three.js, `Material.clone()` copies `userData`, so the per-avatar cloned material inherits `__modelCacheShared: true`. `disposeAvatar()` then skips that cloned material, even though it is no longer a cache-owned shared material and should be disposed when a player avatar or cosmetic preview avatar is rebuilt. This causes material leaks on avatar rebuilds and cosmetic-preview updates, and the added test masks the bug because its fake material clone does not copy `userData` the way Three.js does.

### A test asserts shared resources survive disposeOne

Covered. `client/test/model-dispose.test.js` asserts shared resources survive `disposeOne()`, and coverage shows `client/test/model-dispose.test.js` and `client/test/model-cache-shared.test.js` passed. However, the avatar material test is not faithful to production Three.js clone behavior, so it gives false confidence for the per-avatar material disposal path.

## Design and requirements consistency

The implementation is consistent with the design and foundation requirements: it stays client-rendering scoped, does not change gameplay rules, networking, movement, dungeon flow, or server state, and the captured run still renders a 3D scene, connects via WebSocket, shows multiplayer state, and supports movement. No debug scenario was added or changed.

## Code quality

The cache-shared flag approach is small and well localized, but it needs to distinguish true cache-owned resources from per-instance clones. As written, cloned player body materials can inherit the shared flag and bypass disposal. That is a real GPU lifecycle regression in the same disposal system this ticket is meant to fix, so the ticket is not robust enough to pass.

## Remaining gaps

1. Per-avatar cloned glTF materials can inherit the model-cache shared flag and leak on `disposeAvatar()`. In real Three.js, `Material.clone()` copies `userData`, so the cloned player body material made in `retargetPlayerBodyMesh()` remains `isModelCacheShared()` and is skipped by disposal. Clear the cache-shared marker on cloned per-instance materials, and update the test fake or use real Three materials so the regression is covered.

VERDICT: FAIL
