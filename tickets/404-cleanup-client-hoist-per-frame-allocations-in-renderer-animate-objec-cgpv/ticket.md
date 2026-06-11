# Cleanup nits from client-hoist-per-frame-allocations-in-renderer-animate-objec-cgpv

> **Staleness note.** This follow-up ticket was written against commit
> `a71eacb0` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `client-hoist-per-frame-allocations-in-renderer-animate-objec-cgpv`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Cosmetic signature still recomputed every network tick

Socket.IO `stateUpdate` JSON deserialization creates a fresh `cosmetic` object each tick, so `mesh.userData.cosmeticRef === pData.cosmetic` rarely hits in live multiplayer and `cosmeticSignature()` still runs once per player per frame (same as pre-ticket). A content-equality short-circuit (e.g. update `cosmeticRef` after a matching `cosmeticKey` check, or compare serialized cosmetic fields) could eliminate those template-string allocations during normal play.

### Acceptance Criteria
- With two players in a running dungeon, profiling or a test spy shows `cosmeticSignature` is not invoked on ticks where no player's cosmetic fields changed.
- Avatar rebuild still occurs when cosmetic fields actually change (hub appearance edit, remote player equip).

## Object.keys still allocates per player loop

Replacing `Object.entries` removed the extra entry-array allocations, but `Object.keys(gs.players)` still allocates a keys array each frame in `syncPlayerMeshes` (twice) and `syncPhaseStepAllyHighlight`. A future pass could iterate `for (const id in gs.players)` or maintain a cached player-id list updated only on join/leave.

### Acceptance Criteria
- Player sync loops in `playerSync.js` and `syncPhaseStepAllyHighlight` in `renderer.js` do not allocate a new array each `animate()` frame under steady-state multiplayer.
- Player join/leave and mesh disposal behavior unchanged (existing renderer tests pass).
