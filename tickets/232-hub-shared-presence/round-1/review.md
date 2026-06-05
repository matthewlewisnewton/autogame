## Runtime health

The captured run loads cleanly. `metrics.json` reports `ok: true`, the browser reached gameplay with `sceneInitialized: true`, `hasCanvas: true`, and `pageerrors: []`. `console.log` contains only Vite connection messages and scene initialization logs; there are no `pageerror` or `[fatal]` lines from game code.

## Per-criterion findings

### 1. Party-mates' avatars render and move live in the shared hub

Partially satisfied. The server accepts `move` in lobby phase, applies movement against the shared hub layout, and broadcasts `hubPresenceUpdate` during lobby ticks. The client merges remote presence into `gameState.players`, renders remote avatars with cosmetics, updates position/rotation, and removes meshes when players disappear. The added server integration test covers peer movement in a lobby, and the renderer test covers distinct remote cosmetics.

Blocking gap: the lobby-scoped presence registry can retain players who leave while the squad is in a run. When the lobby later returns to hub phase, that stale entry can be sent again and briefly or repeatedly recreate a ghost remote avatar.

### 2. Presence broadcast is per-lobby scoped and structured for future culling

Mostly satisfied. `hubPresence` is stored on the lobby object, `broadcastHubPresence()` emits only to sockets in that lobby room, and `buildHubPresenceUpdate(lobby, viewerPlayerId)` has the right per-viewer hook for future culling.

The stale-entry issue above also affects this criterion: `buildHubPresenceUpdate()` only skips `connected === false`, so an entry whose player has been removed from `lobby.state.players` is still considered broadcastable.

### 3. Join/leave updates presence correctly

Fails for mid-run leave. Lobby-phase leave is handled, but `leaveLobbyForSocket()` and disconnected-player eviction only remove hub presence when `wasLobbyPhase` is true. If a player leaves during `gamePhase === 'playing'`, their old hub presence remains in `lobby.hubPresence.players`; `syncHubPresenceFromLobbyState()` only upserts current members and does not prune removed members; and `buildHubPresenceUpdate()` does not reject entries missing from `lobby.state.players`.

Normal gameplay supports leaving during a run per `game/docs/lobbies.md`, so presence cleanup must handle that lifecycle even though hub presence is only broadcast after returning to lobby phase.

### 4. Tests

Partially satisfied. Coverage output shows the suite passed: 64 files and 1245 tests. New focused tests cover lobby creation initializing presence, cosmetic payloads, live lobby movement, lobby-phase leave, no hub presence during playing, and renderer merge/removal. The missing case is leaving during a run and then returning to the hub without a ghost presence entry.

### Design and requirements consistency

The implementation is consistent with the lobby/dungeon core loop and does not regress the base requirements for rendering, socket connection, multiplayer visualization, or movement synchronization. No new debug scenario was added or changed.

## Remaining gaps

1. Mid-run leaves can leave stale hub presence behind, causing a removed party member to reappear in hub presence after the lobby returns from playing.

VERDICT: FAIL
