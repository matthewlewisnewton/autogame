# 212-net-reconnect-socket-race-and-dup-listener

## Difficulty: easy

## Goal

Two small networking correctness bugs. (a) findSocketByPlayerId (game/server/index.js:544-551) returns the FIRST socket with a matching playerId; socket.playerId is set at L1115 BEFORE the resume block (L1915-1926) and reconnectPlayerToLobby (L854-857) run, so the lookup can return the NEW socket, leaving the genuinely-stale old socket connected → two live sockets per player both getting stateUpdate. (b) client registers s.on('questError', ...) twice with identical bodies (game/client/main.js:1255-1258 and 1362-1365) → showQuestError fires twice per error.

## Acceptance Criteria

- 1. findSocketByPlayerId takes excludeSocketId (or returns the socket != current) and resolve oldSocket BEFORE assigning socket.playerId; centralize 'evict prior session for player' into one helper used by both the resume block and reconnectPlayerToLobby. 2. Delete one of the duplicate questError listeners. 3. Add a dual-socket-race test (alongside jwt_recovery.test.js).

## Verification

CORRECTNESS, localized. Low risk.
