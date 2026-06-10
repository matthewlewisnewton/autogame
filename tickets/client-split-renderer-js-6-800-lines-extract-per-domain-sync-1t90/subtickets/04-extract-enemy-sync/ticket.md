# Extract the enemy sync block out of animate() into syncEnemyMeshes()

The enemy section of `animate()` (mesh + hitbox create, airborne render Y,
health/shield bars, lock-on rings, the HP-drop minion-attribution VFX,
telegraphs, reveal/variant/frenzied indicators, slow/burn markers, and the
trailing batch of `disposeStaleMeshes` + bookkeeping cleanups) is ~250 lines
inlined in `animate()`. Extract it verbatim into a single function so `animate()`
delegates instead of inlining. Builds on the minion-VFX data table from
sub-ticket 02.

## Acceptance Criteria

- A new exported function `syncEnemyMeshes(gs)` exists in `game/client/renderer.js` containing the moved enemy logic.
- `syncEnemyMeshes` covers, unchanged: the `currentEnemyIds` set, the `for (const enemy of gs.enemies)` loop (mesh + `createEnemyHitboxGroup` creation, `enemyMeshHalfHeight` + `flyingRenderOffset` render Y, `syncFlyingShadow`, health bar + shield bar ensure/position/update, hitbox positioning, `syncLockOnRing`, the HP-drop block using the `MINION_HIT_VFX` table from sub-ticket 02 with its `CARD_HIT_GRACE_MS` guard, windup telegraph create/update + `applyWindupFlash`, `applyRevealHighlight`, `applyEnemyVariantTint`, `applyVariantMarker`, `applyVariantEmissiveTint`, `applyFrenziedTelegraphRing`, enemy slow/burn indicators), and the full trailing cleanup batch (all the `disposeStaleMeshes(...)` calls for enemy maps, the `previousEnemyHp` / `lastCardHitTime` deletions, telegraph dispose, and the `windupFlashing` set pruning).
- `animate()` replaces the removed block with a single `syncEnemyMeshes(gs)` call, after `syncPlayerMeshes` and before the minion sync.
- All module-scoped enemy state (`enemiesMeshes`, `enemyHealthBars`, `enemyShieldBars`, `enemyHitboxMeshes`, `enemyShadows`, `enemyLockOnRings`, `telegraphMeshes`, `variantMarkerMeshes`, `frenziedTelegraphMeshes`, `enemySlowMarkers`, `enemyBurnMarkers`, `previousEnemyHp`, `lastCardHitTime`, `windupFlashing`) is read/written correctly from within the function.
- Rendering behavior is unchanged; existing renderer tests pass, including `game/client/test/renderer-shield-bar.test.js`, `renderer-variant.test.js`, and `airborne-floor-render.test.js`.

## Technical Specs

- File: `game/client/renderer.js` only. The block to move is roughly lines 6620–6770 of `animate()` (from `const currentEnemyIds = …` through the `windupFlashing` cleanup loop).
- This sub-ticket assumes the `MINION_HIT_VFX` table from sub-ticket 02 already exists; the moved HP-drop code should call it, not re-introduce the old ladder.
- You MAY use the `syncMeshMap` helper from sub-ticket 01 only where it does not change behavior (the enemy loop does per-entity work beyond create/position, so a straight call may not fit — prefer a faithful move over forcing the helper). The dispose batch must remain semantically identical.
- Do not alter the player or minion sections in this sub-ticket.

## Verification: code
