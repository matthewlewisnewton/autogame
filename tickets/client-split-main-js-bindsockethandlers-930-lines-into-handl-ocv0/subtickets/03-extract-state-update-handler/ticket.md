# Extract STATE_UPDATE handler

## Description

Move the large `SERVER_TO_CLIENT.STATE_UPDATE` listener (~200 lines) out of `main.js` into `bindStateHandlers`. This handler owns phase transitions, HUD sync, hand reconciliation, movement prediction reconciliation, dash VFX detection, and key-item cooldown HUD updates.

## Acceptance Criteria

- `game/client/socketHandlers/stateHandlers.js` exports `bindStateHandlers(s, ctx)` containing the full `STATE_UPDATE` callback moved verbatim from `main.js`
- `bindSocketHandlers` calls `bindStateHandlers(s, socketHandlerCtx)`; no `STATE_UPDATE` registration remains inline in `main.js`
- Handler logic preserved: hand preservation when server omits hand array, layout seed warning, `debugGodmode` re-apply, hub vs quest layout selection, lobby/playing phase transitions, extracted-player overlay, vanguard HUD, hand/deck reconciliation, loot prune, prediction reconciliation thresholds, dash VFX jump detection, key-item cooldown HUD
- Existing tests touching `stateUpdate` behavior in `game/client/test/main.test.js` pass (lobby overlay, godmode sync, deck/hand reconciliation, movement prediction, etc.)

## Technical Specs

- **Add:** `game/client/socketHandlers/stateHandlers.js` — single `s.on(SERVER_TO_CLIENT.STATE_UPDATE, ...)` registration
- **Edit:** `game/client/socketHandlers/socketHandlerCtx.js` — add ctx fields for all closures referenced inside STATE_UPDATE (`gameState`, `suspendedRunSummary`, `currentLayoutSeed`, `currentLayout`, `hubLayout`, `hand`, `deck`, `myId`, `debugGodmodeResult`, `_prevDashX`/`_prevDashZ`, `keyItemCooldownUntilClient`, and helper refs: `setGameStateRef`, `syncPassageLockColliders`, `returnToGuildLobby`, `renderHand`, `setPlayerPosition`, `getPlayerPosition`, `triggerDashVFX`, `renderKeyItemHud`, etc.)
- **Edit:** `game/client/main.js` — remove inline STATE_UPDATE body (~lines 1359–1571); delegate to `bindStateHandlers`

## Verification: code
