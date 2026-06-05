# Holistic Review

## Runtime Health

PASS. The captured game run started and loaded cleanly: `metrics.json` has `"ok": true`, the server/client started, `pageerrors` is empty, and `console.log` contains no `pageerror` or `[fatal]` entries from game code. The only console noise observed was a pair of `409 Conflict` resource loads during the auth/lobby flow, with no uncaught browser exception.

## Acceptance Criteria Findings

### Player can move in the hub during lobby phase

PARTIAL. The server now accepts `move` while `gamePhase === 'lobby'`, keeps the existing finite payload / sequence / magnitude validation, and `runGameLoopTick` simulates lobby movement without enabling combat or enemy updates. The client initializes a Three.js scene on first lobby join and `updateMyPlayer` still emits movement regardless of phase, so the initial lobby-join path is covered by code and tests.

However, this is not robust across the whole lobby lifecycle. When a run returns to lobby, the server correctly calls `_applyHubLayout(state)`, but `stateUpdate` does not include the full layout. The client then assigns `gameState = state` and immediately overwrites `gameState.layout` with the prior `currentLayout` before calling `returnToGuildLobby(..., { rebuildHub: true })`. Because `currentLayout` is still the dungeon layout from the just-finished run, `restoreHubLobbyScene` sees a non-hub profile and returns without rebuilding hub geometry. The player is back in lobby on the server, but the client can remain visually and locally bounded to the old dungeon layout.

### Movement bounded to hub geometry

PARTIAL. Initial lobby movement is bounded server-side by the hub `walkableAABBs` and wall colliders set by `applyHubLayout`, and the new server tests exercise attempted movement toward hub exterior bounds. The return-to-lobby bug above breaks this criterion client-side after a normal run/give-up/abandon/suspend transition, because prediction/collision can still use dungeon geometry while the authoritative server uses hub geometry.

### Test for lobby-phase move accept/bounds

PASS for the server path. `game/server/test/lobbyPhaseMovement.test.js` covers lobby move acceptance, invalid/stale input rejection, and exterior bounds. `game/server/test/hubLobbyLayout.test.js` covers hub layout setup and quest layout application on deploy. `game/client/test/hubLobbyScene.test.js` covers first lobby scene initialization, quest layout updates while in lobby, and start-game dungeon rebuild. The missing coverage is specifically the client return-to-lobby rebuild path, which is the blocking gap.

## Design And Requirements

The server-side change is consistent with `game/docs/design.md`: the lobby remains the squad/guild space, quest selection is metadata until deploy, and dungeon layouts are applied only when entering a run. The implementation preserves the foundation requirements for Three.js rendering, WebSocket connection, multiplayer visualization, and movement synchronization during the captured run.

The client return-to-lobby layout mismatch is inconsistent with the intended lobby/dungeon loop because returning to the lobby should restore the hub environment, not leave the previous dungeon mesh active.

## Code Quality Notes

The state threading in `applyPlayerMovement(state = _gameState)` is a good direction and avoids adding new movement-path `_gameState` reads for players/layout. Existing lobby-context wrapping keeps colliders and persistence pointed at the active lobby during the server tick.

No debug scenario was added or changed for this ticket. Existing debug scenario handling remains URL-parameter gated on localhost and was not used by the capture (`scenarios: []`).

`pnpm` coverage visibility shows `65` test files and `1362` tests passed. Coverage thresholds were disabled; relevant touched files were included in the report.

## Remaining gaps

1. Returning from a run to lobby can leave the client on stale dungeon geometry instead of rebuilding hub geometry.
   Files: `game/client/main.js`, `game/server/progression.js`
   Fix: ensure the client receives/retains the hub layout on lobby re-entry before `restoreHubLobbyScene` runs, and add a client test for playing -> lobby state update rebuilding `profile: 'hub'`.

VERDICT: FAIL
