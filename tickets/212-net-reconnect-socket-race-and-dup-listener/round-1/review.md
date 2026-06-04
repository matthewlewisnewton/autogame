# Senior Review — 212-net-reconnect-socket-race-and-dup-listener

## Runtime health

Capture artifacts confirm the game starts and loads cleanly:

- `metrics.json`: `"ok": true`, empty `pageerrors`, no `harness_failure`, no `failure_kind`
- `console.log`: only Vite connect and `[initScene]` lines — no `pageerror` or `[fatal]` entries
- `pageerrors.json`: `[]`
- Smoke capture reached lobby → gameplay → dodge with connected state, canvas, and HUD probes passing

No runtime blockers.

## Per-criterion findings

### AC1 — `findSocketByPlayerId` exclude + prior-socket eviction helper

**Met.**

`findSocketByPlayerId(playerId, excludeSocketId)` now skips the current socket when searching, which fixes the race where the newly connecting socket already had `socket.playerId` assigned and was returned as the “prior” session.

```524:541:game/server/index.js
function findSocketByPlayerId(playerId, excludeSocketId) {
  for (const socket of io.sockets.sockets.values()) {
    if (excludeSocketId && socket.id === excludeSocketId) {
      continue;
    }
    if (socket.playerId === playerId) {
      return socket;
    }
  }
  return null;
}

function evictPriorSocketForPlayer(playerId, currentSocketId) {
  const priorSocket = findSocketByPlayerId(playerId, currentSocketId);
  if (priorSocket && priorSocket.connected) {
    priorSocket.disconnect(true);
  }
}
```

`socket.playerId = playerId` is assigned **after** the resume block (line 1914), so lookup during reconnect cannot match the incoming socket.

Eviction is centralized in `evictPriorSocketForPlayer` and invoked from `reconnectPlayerToLobby`. The resume-on-connect path delegates to that same function instead of inlining disconnect logic:

- Resume block (lines 1904–1911): uses `findSocketByPlayerId(playerId, socket.id)` to detect a live prior socket, then calls `reconnectPlayerToLobby(socket, resumeLobby, playerId)`.
- `joinLobby` drop-in reconnect (line 1199): also routes through `reconnectPlayerToLobby`.

Supporting change: `emitLobbyJoined` / `reconnectPlayerToLobby` accept `explicitPlayerId` so lobby rejoin works before `socket.playerId` is stamped on the new connection — necessary for the ordering fix.

Unit coverage for `excludeSocketId` was added in `server.test.js` (`findSocketByPlayerId` describe block, lines 2044–2058).

### AC2 — Remove duplicate `questError` listener

**Met.**

Only one `questError` handler remains in `bindSocketHandlers` (line 1258). The duplicate at the former lines 1362–1365 was removed. Grep confirms a single registration site.

### AC3 — Dual-socket-race regression test

**Met.**

`game/server/test/dual_socket_race.test.js` sits alongside `jwt_recovery.test.js` under `game/server/test/`. It connects two sockets with the same JWT, asserts the first disconnects, and verifies exactly one live server socket with the second socket’s id. Harness coverage log and local `pnpm test:quick` both report the test passing.

## Design & requirements consistency

- Localized server/client networking correctness fix; no changes to gameplay loop, combat, or lobby phase policy.
- No new debug scenarios added — nothing to gate-check.
- Aligns with design doc networking expectations (JWT auth, lobby drop-in/rejoin) without altering documented player flows.

## Code quality

- Fix is minimal and targeted (50 lines changed in `index.js`, 5 removed in `client/main.js`).
- No dead code introduced; helper is used on the reconnect path that resume-on-connect shares.
- No browser console defects in capture.
- Changed-file coverage (`index.js` ~89%) is adequate for this scope; new paths exercised by unit + integration tests.

## Debug scenarios

Not applicable — this ticket did not add or modify any `?debugScenario=` shortcuts.

## Remaining gaps

None. All three acceptance criteria are fully satisfied, runtime capture is clean, and regression tests pass.

VERDICT: PASS
