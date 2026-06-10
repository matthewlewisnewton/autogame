# Extract the player/avatar sync block out of animate() into syncPlayerMeshes()

The per-player section of `animate()` (avatar build/rebuild on cosmetic change,
proportion + tint reapply, key-item prop, slow/burn/card-windup indicators,
remote + self positioning, airborne height, shields, flying shadows, HP-drop
flash + damage numbers, nameplates, smoke puffs, and the leave-cleanup loops) is
~300 lines inlined in `animate()`. Extract it verbatim into a single function so
`animate()` delegates instead of inlining.

## Acceptance Criteria

- A new exported function `syncPlayerMeshes(gs, myId)` exists in `game/client/renderer.js` containing the moved player logic.
- `syncPlayerMeshes` covers, unchanged: the `for (const [id, pData] of Object.entries(gs.players))` loop (cosmetic-signature avatar rebuild, `applyLoadedModelCosmetic`, `updateKeyItemProp`, slow/burn/card-windup indicators, remote positioning with `flyingRenderOffset`, `syncFlyingShadow`, dead/base color, remote HP-drop flash, remote nameplate); the `myId` self block (airborne local Y, respawn reset, dead/invuln material, shield VFX follow, self HP-drop flash + `spawnDamageNumber`, self nameplate); the smoke-puff loop; and the leave-cleanup loops for `playerNameplates`, `playerSlowMarkers`, `playerBurnMarkers`, `playerCardWindupMarkers`, and `playerShadows`.
- The `syncPhaseStepAllyHighlight(gs, myId)` call stays at its current position relative to the moved code (either kept in `animate()` or moved into `syncPlayerMeshes`, but invoked exactly once per frame as before).
- `animate()` replaces the removed block with a single `syncPlayerMeshes(gs, myId)` call, inside the existing `if (gs)` guard, before the enemy sync.
- All module-scoped state the block touches (`playersMeshes`, `playerShadows`, `playerNameplates`, `playerSlowMarkers`, `playerBurnMarkers`, `playerCardWindupMarkers`, `playerCardWindupFlashing`, `previousPlayerHp`, `shieldVFX`, `smokeVFX`, `myX`, `myZ`, `simX`, `wasDead`, `spawnPosition`, lock-on state, etc.) continues to be read/written correctly from within the function (same module scope — no signature plumbing of these).
- Loot-proximity emission (`findClosestLootInRange` / `tryEmitLootPickup`) and `updateMyPlayer` stay in `animate()` and are NOT moved.
- Rendering behavior is unchanged; existing renderer tests pass, including `game/client/test/airborne-floor-render.test.js`, `avatar-cosmetic-render.test.js`, and `hub-lobby-render.test.js`.

## Technical Specs

- File: `game/client/renderer.js` only. The block to move is roughly lines 6316–6620 of `animate()` (from the players `for…of` loop through the player leave-cleanup loops), plus the smoke-puff loop just after.
- Keep self-player respawn side effects (resetting `myX/myZ/simX/simZ/prevSimX/prevSimZ`, `moveAccumulator`, `resetSimVelocity()`, `playerRotation`, `lastEmittedRotation`, `clearAllLockOnState()`, lock-on targets) intact — these mutate module state and must run in the same order.
- Do not alter the enemy/minion/loot reconcile sections in this sub-ticket.

## Verification: code
