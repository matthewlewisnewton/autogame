# Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler

## Difficulty: hard

## Goal

game/client/renderer.js is a god-file whose animate() (renderer.js:6161-6797, ~640 lines) inlines loot pickup emission, avatar rebuild/cosmetic diffing, nameplate sync, HP-drop detection with a ~100-line nested minion-attribution ladder (6455-6572), enemy/minion/spike-trap/loot/ice-ball mesh reconciliation, atmosphere lerping, and camera. The keyed-mesh-map reconcile pattern (create/update/disposeStale) appears ~10 times. Fix: extract per-domain sync modules (playerSync, enemySync, effects, avatar, lootSync) plus one generic syncMeshMap(map, items, create, update) helper so animate() becomes a short orchestrator; move the HP-drop/minion-VFX ladder into a data table keyed by minion type (half-exists in cardRenderers styles). Mechanical but large — decompose into per-module sub-tickets; do AFTER the enemy-VFX and shared-dispose bug fixes land to avoid conflicts. Found in code review 2026-06-09.

## Acceptance Criteria

- animate() under ~150 lines delegating to extracted sync modules; a shared syncMeshMap helper replaces the repeated reconcile pattern; rendering behavior unchanged (existing renderer tests pass)

## Verification

worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', '/home/matt/workspace/.autogame-worktrees/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', '/home/matt/workspace/.autogame-worktrees/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', '/home/matt/workspace/.autogame-worktrees/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', '/home/matt/workspace/.autogame-worktrees/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', '/home/matt/workspace/.autogame-worktrees/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', 'HEAD'])
worktree create failed: CalledProcessError(255, ['git', 'worktree', 'add', '-b', 'auto/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', '/home/matt/workspace/.autogame-worktrees/Client: split renderer.js (6,800 lines) — extract per-domain sync modules and a generic mesh-map reconciler', 'HEAD'])
merge rejected: post-rebase verification failed
