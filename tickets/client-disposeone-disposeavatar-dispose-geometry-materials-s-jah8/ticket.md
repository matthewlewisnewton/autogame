# Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache

## Difficulty: medium

## Goal

loadModel returns gltf.scene.clone(true) (game/client/models.js:104) which shares geometries/materials with the cached source and every other live clone. disposeOne (game/client/renderer.js:5764-5780) and disposeAvatar (renderer.js:2399-2407) traverse the host including userData.modelOverride and call geometry.dispose()/material.dispose() on every node — so every enemy/minion death, avatar cosmetic rebuild, or cosmetic-preview updatePreview() (game/client/cosmetic-preview.js:66) disposes GPU resources still in use by the cache and all other instances of that type, forcing Three.js to silently re-upload vertex buffers and recompile programs each time. Fix: mark nodes belonging to the shared clone on attach and skip them in dispose traversals (or refcount, or deep-clone geometry/material on attach where per-instance mutation is needed). Found in code review 2026-06-09.

## Acceptance Criteria

- Despawning one modeled entity does not dispose geometry/materials used by the model cache or other live instances; cosmetic preview tweaks do not re-upload shared buffers; a test asserts shared resources survive disposeOne

## Verification

worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', '/home/matt/workspace/.autogame-worktrees/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', '/home/matt/workspace/.autogame-worktrees/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', '/home/matt/workspace/.autogame-worktrees/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', '/home/matt/workspace/.autogame-worktrees/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', '/home/matt/workspace/.autogame-worktrees/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', '/home/matt/workspace/.autogame-worktrees/Client: disposeOne/disposeAvatar dispose geometry/materials shared with the glTF model cache', 'HEAD'])
merge rejected: rebase conflict; resolver could not integrate
