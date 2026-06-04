# 210-net-extract-socket-handlers

## Difficulty: medium

## Goal

The io.on('connection') closure in game/server/index.js is ~840 lines (L1102-1942) holding all ~30 socket.on handlers; index.js is 2193 lines and the hottest merge-conflict surface. useCard/useKeyItem already delegate to cardEffects/keyItemEffects — finish that pattern.

## Acceptance Criteria

- 1. Move per-event handlers into game/server/socketHandlers/* modules, each exporting register(socket, ctx) where ctx bundles identity + helpers (withLobbyFromSocket, broadcastLobbyUpdate, findSocketByPlayerId, savePlayerData). 2. connection handler shrinks to building ctx + calling each register. 3. While here: delete dead handlers buyShopCard (L1605) and listKeyItems (L1134) if grep confirms no client emitter; extract notifyPlayerRemoved() helper for the 3 copy-pasted leave-broadcast blocks (L886-896/920-931/945-960). 4. Behavior-preserving; server test suite green (server/integration/lobbies/key-items tests).

## Verification

Pure move + dependency-injection; do in slices per concern (lobby/deck/trade/keyItem/run). SIMPLICITY. Risk: dropping a captured local — rely on existing server tests.

merge rejected: post-rebase verification failed
