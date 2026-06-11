# Hoist reusable ID Sets in enemy and minion mesh sync

Each `animate()` frame currently allocates a fresh `Set` from `gs.enemies.map(...)` and `gs.minions.map(...)` inside the per-frame reconcile helpers. Replace those with module-scoped Sets that are cleared and repopulated each frame so stale-mesh disposal keeps working without per-frame `Set` construction.

## Acceptance Criteria

- `syncEnemyMeshes` no longer contains `new Set(` on the per-frame path; a module-level Set is cleared and refilled with enemy ids each call
- `syncMinionMeshes` no longer contains `new Set(` on the per-frame path; same pattern for minion ids
- Stale enemy/minion meshes, health bars, shadows, and related maps are still disposed when entities leave the snapshot (behavior unchanged)
- `pnpm test:quick` passes; existing renderer enemy/minion tests are green

## Technical Specs

- **File:** `game/client/renderer/enemySync.js`
  - Add a module-level `_currentEnemyIds = new Set()` (name may vary to match local style)
  - At the start of `syncEnemyMeshes(gs)`: `_currentEnemyIds.clear()`, then `add(enemy.id)` inside the existing enemy loop (or a dedicated first pass) instead of `new Set(gs.enemies.map(...))`
  - Pass `_currentEnemyIds` to all existing `disposeStaleMeshes(...)` / `currentEnemyIds.has(...)` cleanup sites unchanged in behavior
- **File:** `game/client/renderer/minionSync.js`
  - Same hoist for `_currentMinionIds` in `syncMinionMeshes(gs)`
- Do **not** change `seenMinionIds` (spawn-once bookkeeping) — only the per-frame reconcile Set

## Verification: code
