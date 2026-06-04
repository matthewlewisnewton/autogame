# 218-lobby-handler-preamble-and-session-helper

## Difficulty: easy

## Goal

Two same-area lobby dedups. (a) The preamble 'if (state.gamePhase!=='lobby') return; const player=state.players[socket.playerId]; if(!player) return;' recurs across ~12 handlers in game/server/index.js (selectQuest 1277, playerReady 1311, buyShopCard 1605, unlockHat 1628, deckAddCard 1397, sellCard 1569, grindCard 1700, medicHeal 1677...). (b) The session object literal is duplicated verbatim at index.js:1120-1128 and 1188-1196.

## Acceptance Criteria

- 1. Add withLobbyPlayer(socket,{phase},(state,lobby,player)=>{...}) wrapper over withLobbyFromSocket that resolves the player, emits the standard error, optionally asserts a phase; migrate handlers incrementally. 2. Add buildSessionFromPlayer(player) helper to kill the duplicated session literal. 3. Tests green.

## Verification

SIMPLICITY, mechanical/incremental. Depends on 217 (same files/phase model). Low risk.
