# Extract run lifecycle and debug socket handlers

## Description

Finish the split by moving run deploy/completion/suspension handlers, debug harness replies, heartbeat latency, and player disconnect cleanup into dedicated modules. After this sub-ticket, `bindSocketHandlers` in `main.js` should only orchestrate `bind*` calls (plus the `giveUpBtnEl.onclick` wiring or its extraction).

## Acceptance Criteria

- `game/client/socketHandlers/runHandlers.js` exports `bindRunHandlers(s, ctx)` with: `START_GAME`, `RUN_COMPLETE`, `RUN_FAILED`, `RUN_ERROR`, `RUN_SUSPENDED`, `RUN_ABANDONED`, `PLAYER_EXTRACTED`, `CARD_REWARD_CLAIMED`, and `giveUpBtnEl.onclick = () => requestGiveUp(s)` if still co-located with run handlers
- `game/client/socketHandlers/debugHandlers.js` exports `bindDebugHandlers(s, ctx)` with: `HEARTBEAT_ACK`, `DEBUG_SCENARIO_RESULT`, `DEBUG_GODMODE_RESULT`, and `PLAYER_DISCONNECTED`
- `bindSocketHandlers` in `main.js` is a thin delegator calling all `bind*` functions (`bindConnectionHandlers`, `bindInitHandlers`, `bindLobbyBrowserHandlers`, `bindStateHandlers`, `bindCardHandlers`, `bindLobbyHandlers`, `bindRunHandlers`, `bindDebugHandlers`) with the shared `socketHandlerCtx`; no remaining inline `s.on(...)` bodies in `main.js`
- Optional: add `game/client/socketHandlers/index.js` re-exporting the bind functions for cleaner imports
- Full `pnpm test` / `pnpm test:quick` from `game/` passes; top-level ticket acceptance met (no behavior change)

## Technical Specs

- **Add:** `game/client/socketHandlers/runHandlers.js` — move `START_GAME` body (~lines 2046–2104) and run summary/suspension handlers verbatim
- **Add:** `game/client/socketHandlers/debugHandlers.js` — move heartbeat, debug scenario/godmode, and `removeRemotePlayerVisuals` disconnect handler
- **Edit:** `game/client/socketHandlers/socketHandlerCtx.js` — final ctx fields for run/debug deps (`currentLayout`, `renderedSceneProfile`, `suspendedRunSummary`, `claimedCardRewardId`, `debugScenarioResult`, `debugGodmodeResult`, `connectionState`, `statusEl`, `giveUpBtnEl`, `requestGiveUp`, scene init helpers, etc.)
- **Edit:** `game/client/main.js` — reduce `bindSocketHandlers` to null-guard + delegate calls; keep `window.bindSocketHandlers = bindSocketHandlers` export

## Verification: code
