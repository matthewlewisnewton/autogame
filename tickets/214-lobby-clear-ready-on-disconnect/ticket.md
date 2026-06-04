# 214-lobby-clear-ready-on-disconnect

## Difficulty: easy

## Goal

softDisconnectPlayerFromLobby (game/server/index.js:868-898) sets player.connected=false but never clears player.ready. checkAllReady (game/server/progression.js:3390-3426) starts the run when all.every(p=>p.ready) — counting disconnected players. So a player can ready up, soft-disconnect, and the run launches with a connected:false ghost occupying a spawn slot (initPlayerHand runs for it); or a lobby gets stuck unable to start.

## Acceptance Criteria

- 1. In softDisconnectPlayerFromLobby set player.ready=false alongside connected=false. 2. Gate checkAllReady on p.connected!==false && p.ready and require >=1 connected player. 3. Add a lobby test (mirror lobbies.test.js) for ready-then-disconnect.

## Verification

CORRECTNESS (real bug). Narrows the start condition; only affects disconnect-mid-lobby. Low risk.
