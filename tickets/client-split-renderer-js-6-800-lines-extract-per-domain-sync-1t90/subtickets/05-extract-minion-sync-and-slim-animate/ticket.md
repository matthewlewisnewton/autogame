# Extract minion + hazard sync into syncMinionMeshes() and slim animate() to a short orchestrator

Move the remaining inlined reconcile block (minion summon-in scale, airborne
hover Y, null-crawler telegraph + emissive, HP-drop flash/damage numbers, the
minion dispose/bookkeeping cleanups, and the spike-trap hazard sync) out of
`animate()` into a sync function. After this, with the player/enemy extractions
from sub-tickets 03/04 already landed, `animate()` becomes a short orchestrator
that delegates to the extracted sync functions.

## Acceptance Criteria

- A new exported function `syncMinionMeshes(gs)` exists in `game/client/renderer.js` containing the moved minion logic: the `currentMinionIds` set, the `for (const minion of (gs.minions || []))` loop (mesh create + `seenMinionIds` / `minionSpawnTimes` / `minionBaseScales` summon-in handling, `flyingRenderOffset` hover Y, `syncFlyingShadow`, summon-in scale easing, null-crawler windup telegraph create/update + emissive set/reset, HP-drop `flashMesh` + `spawnDamageNumber`), and the trailing `disposeStaleMeshes` + `previousMinionHp` / `seenMinionIds` cleanup loops.
- The spike-trap hazard reconcile (already routed through `syncMeshMap` in sub-ticket 01) is moved into its own short function `syncSpikeTrapMeshes(gs)` (or folded into `syncMinionMeshes`), invoked once per frame in the same position.
- `animate()` replaces the removed minion + spike-trap blocks with `syncMinionMeshes(gs)` (and `syncSpikeTrapMeshes(gs)` if separate); the existing one-line `syncLootMeshes()`, `syncIceBallMeshes()`, and `syncTelepipeMesh()` calls remain.
- `animate()` is under 150 lines and reads as an orchestrator: delta/`updateMyPlayer`/`pollInput`/`updateBoothInRange`, loot-proximity emission, then within the `if (gs)` guard `syncPlayerMeshes` → `syncEnemyMeshes` → `syncMinionMeshes` → spike-trap → loot/ice-ball/telepipe, followed by the existing post-guard tail (`animateLootMeshes`, `animateTelepipePortal`, camera orbit, atmosphere update, `updateAttackEffects`, `updateEnemyHitboxPulse`, `updateDamageNumbers`, `updateCollectingLoot`, `renderer.render`).
- All module-scoped minion state (`minionsMeshes`, `minionShadows`, `minionTelegraphMeshes`, `previousMinionHp`, `seenMinionIds`, `minionSpawnTimes`, `minionBaseScales`) is read/written correctly from within the function.
- Rendering behavior is unchanged; the full renderer test suite passes, including `game/client/test/renderer-minion-summon.test.js`, `renderer-spike-trap.test.js`, `renderer-telepipe-portal.test.js`, and `renderer-loot.test.js`.

## Technical Specs

- File: `game/client/renderer.js` only. The minion block to move is roughly lines 6770–6870 of `animate()`; the spike-trap block immediately follows it.
- This sub-ticket depends on 03 and 04 having already extracted the player and enemy blocks — only with all three moved does `animate()` reach the under-150-line orchestrator target. If, after extraction, `animate()` still exceeds 150 lines, factor the remaining post-guard tail's repetitive atmosphere `if/else` into a small helper, but do not change its behavior.
- Keep the summon-in animation timing (`MINION_SUMMON_IN_MS`, `0.001` initial scale, eased growth, settle/delete) byte-for-byte identical.

## Verification: code
