# Gameplay Review

This document describes how the game actually behaves today, grounded in server authority and client UI code. It is written for reviewers comparing player-visible flow against implementation.

## Current gameplay

### Authentication and lobby browser

Players must register or log in through the auth overlay before connecting. The client calls `/api/register` or `/api/login`, stores the returned JWT, and opens a Socket.IO connection via `createSocket()` in `game/client/main.js`. The server validates the token in middleware before the connection handler runs; invalid tokens produce a `connect_error` and the client re-shows login.

On connect, the server registers a **session** for the account (`lobbies.registerSession` in `game/server/lobbies.js`) but does **not** place the player into any lobby. The final `init` payload includes account data, the public lobby list, and `inLobby: false` (see the connection handler in `game/server/index.js`). The client `init` handler shows `#lobby-browser` via `showLobbyBrowser()` and renders the list with `renderLobbyList()` — it only skips the browser when `data.inLobby` is true (reconnect path). This replaced the older single-global-lobby auto-placement described in `game/docs/lobbies.md`.

From the browser, a player can refresh the list (`listLobbies` → `lobbyListUpdate`), create a lobby (`createLobby`), or join one (`joinLobby`). Gameplay socket events (`playerReady`, `move`, `useCard`, etc.) require lobby membership; otherwise the server emits `lobbyError`.

### Creating, joining, and drop-in

**Create:** `createLobby` in `game/server/index.js` calls `lobbies.createLobby(hostId, name)`, which allocates a fresh per-lobby state via `createLobbyGameState()` (`gamePhase: 'lobby'`, empty players, default quest, `telepipe: null`, `suspendedCheckpoint: null`). The host is joined through `joinPlayerToLobby`, which assigns membership, joins the Socket.IO room named after the lobby id, and emits `lobbyJoined` with full lobby state.

**Join / drop-in:** `joinLobby` resolves the target lobby and calls the same `joinPlayerToLobby` path. Each lobby owns an isolated `lobby.state` object; simulation and progression read it through `withLobbyContext` (a re-entrant context stack in `game/server/index.js` that temporarily sets `_gameState` for `game/server/progression.js` and `game/server/simulation.js`). Broadcasts such as `startGame` and `stateUpdate` go to `io.to(_gameState._lobbyId)` when scoped.

The lobby browser shows each entry's phase (**Waiting** vs **In run**), player count, and quest. Lobbies with `gamePhase === 'playing'` render a **Drop In** button (`data-join-mode="drop-in"` in `renderLobbyList`); waiting lobbies show **Join**. Drop-in adds the player to an in-progress run: `joinPlayerToLobby` calls `initializePlayerForActiveRun` to build hand/deck, restore HP and magic stones, and reset cooldowns without resetting enemies, layout, or run objective. Existing squad members see a `lobbyUpdate` / `playerDisconnected` as appropriate.

**Leave:** `#leave-lobby-btn` emits `leaveLobby`. `leaveLobbyForSocket` saves player data, removes the player from `lobby.state.players`, and broadcasts an updated lobby list. If other players remain, the lobby persists — including an active dungeon run. When the last player leaves (or disconnects past the grace period and is evicted), `lobbies.removePlayerFromLobby` deletes the lobby from the in-memory registry and discards its state.

### Squad lobby: deck, quest, ready, deploy

Inside a lobby (`#lobby`), players use the existing pre-run UI: deck editor, quest board, shop, trades, medic, and key items. Deck changes and shop purchases are validated server-side by `validateDeck` in `game/server/progression.js` (minimum/maximum size and owned-card constraints).

Quest selection emits `selectQuest`; the server only accepts changes while `gamePhase === 'lobby'` and blocks changes while a suspended checkpoint exists. Changing quest regenerates layout via `applyLayoutForQuest` and broadcasts `questUpdate`.

Ready-up uses the **Deploy** button (`#ready-btn`, themed via `THEME.lobby.deploy`). Clicking toggles `playerReady` on the server. When a player readies, the server runs `validateDeck`; invalid decks emit `deckError`, force `ready = false`, and do not count toward launch. When every connected player in the lobby has `ready: true` and `gamePhase === 'lobby'`, `checkAllReady()` in `game/server/progression.js` transitions to `gamePhase: 'playing'`, assigns staggered spawn positions, builds draw decks from each player's selected loadout, spawns enemies, calls `startDungeonRun()`, and emits `startGame` plus `stateUpdate` to the lobby room. The client `startGame` handler hides the lobby overlay, shows the dungeon HUD and card hand, and initializes or resumes the Three.js scene.

While waiting, `lobbyUpdate` keeps the player list, ready flags, and quest board in sync. Only the lobby host's quest choice applies to the shared run until deploy.

### Mid-run persistence and empty-lobby teardown

During `gamePhase: 'playing'`, a player may leave via `leaveLobby` or disconnect. On voluntary leave, `savePlayerData` persists currency, inventory, and deck choices before removal. Player-owned minions are stripped from `lobby.state.minions`. Remaining players continue the run; simulation skips extracted or disconnected players per guards in `game/server/index.js` and `game/server/simulation.js`.

Soft disconnect keeps the player record in `lobby.state.players` with `connected: false` for up to `DISCONNECT_GRACE_MS`; reconnect with the same account and lobby id calls `reconnectPlayerToLobby` instead of treating it as a duplicate join. After grace expiry, `evictDisconnectedPlayers` removes the record similarly to an explicit leave.

If at least one player stays connected (or remains in the lobby mid-run), dungeon state — enemies, loot, layout, run objective, telepipe portal — persists. If the lobby empties, the registry entry is deleted and all run state is discarded; there is no cross-lobby or cross-restart persistence for in-flight runs.

### Telepipe: placement, extraction, suspend, resume, abandon

Telepipe is a mid-run evacuation spell documented in `game/docs/design.md` and `game/docs/telepipe-tier2-context.md`. One shared portal may exist per run.

**Placement:** A player casts the Telepipe card through `useCard` (`game/server/index.js`). If no portal is active, the server sets `state.telepipe = { x, z, placedBy, placedAt }` at the caster's position, consumes the hand slot, and emits `cardUsed` with `effect: 'telepipe'`. A second placement attempt returns `cardError: 'Telepipe already active'`. A short placement grace (`PORTAL_PLACEMENT_GRACE_MS` in `game/server/config.js`) prevents immediate self-extraction.

**Per-player extraction:** Each squad member enters the portal individually — either by walking within `PORTAL_RADIUS` (`checkTelepipeProximity` → `tryEnterTelepipe` in `game/server/progression.js`) or equivalent server validation. The player gets `extracted: true`, is saved, and receives `playerExtracted`. Extracted players return to the guild lobby overlay (`showExtractedLobbyOverlay` in `game/client/main.js`): HUD hidden, Deploy hidden, banner text from `THEME.run.awaitingExtract`. They cannot move, use cards, or pick up loot while teammates who remain active continue the dungeon.

**Suspend:** The run stays `status: 'playing'` while any player is still active in the dungeon (`hasActivePlayers` / `isPlayerActive`). When the last active player extracts (or is otherwise non-active), `maybeSuspendRun` calls `suspendRunToLobby`: `captureRunCheckpoint()` deep-copies run metadata, layout, enemies, minions, loot, area effects, telepipe position, and per-player combat snapshots into `suspendedCheckpoint`; transient world state is cleared; `gamePhase` returns to `'lobby'`; players are repositioned in the guild lobby with empty hands. The server emits `runSuspended` with quest/objective summary and `stateUpdate`. The client shows the **Resume expedition** banner via `renderSuspendedRunBanner` and re-enables Deploy.

**Resume:** When all players ready again, `checkAllReady()` detects `suspendedCheckpoint` and calls `restoreRunCheckpoint()` instead of spawning a fresh layout. Checkpoint restore rebuilds colliders, clears extracted flags, resets ready flags, and emits `startGame` + `stateUpdate`. The client resume path in the `startGame` handler calls `setGamePhase('playing')` and hides Deploy even when the scene was already initialized.

**Abandon:** While suspended, **Abandon expedition** (`#abandon-run-btn` → `abandonRun` socket) calls `abandonSuspendedRun()` in `game/server/progression.js`, which clears `suspendedCheckpoint` and deletes the run, returning the squad to a normal waiting lobby. Quest changes are allowed again after abandon.
