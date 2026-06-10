# Extract `enemySync` module and minion-attribution data table

Extract the enemy mesh reconcile block from `animate()` into `enemySync.js`, including health/shield bars, telegraphs, variant tints, slow/burn markers, and lock-on rings. Replace the nested minion-type HP-drop VFX ladder (~lines 6468–6585) with a data table keyed by minion type (align flash colors / effect spawners with existing `cardRenderers.js` minion styles).

## Acceptance Criteria

- New module `game/client/renderer/enemySync.js` exports `syncEnemiesFrame({ gs, scene, ... })` that performs the full enemy reconcile currently in `animate()` (~6436–6653): mesh create/update, health/shield bars, hitbox overlays, lock-on rings, windup telegraphs, reveal/variant/frenzied overlays, slow/burn markers, stale disposal across all enemy-associated mesh maps, and `previousEnemyHp` / `lastCardHitTime` / `windupFlashing` cleanup.
- New data table (e.g. `MINION_TICK_VFX_BY_TYPE` in `enemySync.js` or `game/client/renderer/minionTickVfx.js`) maps minion types (`thunderbird`, `storm_eagle`, `ancient_wyrm`, `null_crawler`, `bulkhead_mauler`, default) to: enemy flash hex, minion flash hex, and a `spawnEffect({ enemy, minion, halfHeight })` callback. The old nested `if (fromThunderbird) … else if …` ladder is deleted.
- HP-drop detection still: skips when within `CARD_HIT_GRACE_MS` of `lastCardHitTime`; attributes to nearest minion with a mesh; spawns default `spawnHitSpark` for unattributed / unknown minion types.
- `animate()` calls `enemySync.syncEnemiesFrame` with no inline enemy reconcile code.
- `renderer-variant.test.js`, `renderer-shield-bar.test.js`, `windup-charge.test.js`, and enemy-related tests pass.

## Technical Specs

- **Add** `game/client/renderer/enemySync.js` (and optional `minionTickVfx.js` for the attribution table).
- **Change** `game/client/renderer.js` — remove enemy block from `animate()`; wire `enemySync`; re-export enemy helpers tests use (`createEnemyMesh`, `applyVariantMarker`, `markCardHitEnemies`, etc.).
- **Table entries must preserve current behavior** for each known minion type (flash colors, `spawnChainLightningEffect`, `spawnLightningArc`, `spawnAttackEffect` payloads, `spawnParticleBurst`, `spawnHitSpark` fallback).
- Consider using `syncMeshMap` for the primary `enemiesMeshes` reconcile if sub-ticket 01 is merged; per-enemy overlay updates stay in `update` callbacks.
- Do not move minion mesh sync (sub-ticket 06).

## Verification: code
