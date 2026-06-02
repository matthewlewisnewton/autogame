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

### Cards, deck, hand, and Magic Stones

Each player’s **selected deck** is validated in `game/server/progression.js` (4–24 cards; default loadout 12). Deploy shuffles it into a runtime draw deck (`createDrawDeckFromSelectedDeck`); definitions live in `CARD_DEFS` there and in `game/client/cards.js`, with client hand state in `game/client/hand.js`.

**Hand:** Up to **six** slots (`MAX_HAND_SLOTS`, `game/server/config.js`), **four** dealt at open (`OPENING_HAND_SIZE`). Refills pull from the draw deck, then a desperation deck. `processPassiveDraws` draws every five seconds when a slot is empty and cards remain.

**Card types:** **Weapons** use charges and ~800ms slot cooldowns (`COOLDOWN_MS`), clearing the slot at zero charges. **Spells** and **creatures** cost Magic Stones and leave the hand when played; creatures spawn **minions** updated in `game/server/simulation.js`. **Enchantments** place ground traps or self-buffs (per-player caps). The Vanguard HUD (`game/client/vanguard-hud.js`) shows Magic Stones (cap 99, run start 49; slow regen via `regenMagicStones` plus drops and pickups).

### Dungeon layout and movement

Quest `layoutProfile` (`game/server/quests.js`) selects a generator in `game/server/dungeon.js`: grid rooms linked by **passages**, or special single-space profiles (open plaza, sunken canyon). Rooms carry `floorCorners` for ramps; height at `(x, z)` is **`sampleFloorY`** (`game/shared/floorSampling.esm.js`, re-exported from `game/client/collision.js`; meshes in `game/client/dungeon.js`).

**Movement:** Client prediction and `move` emits (`game/client/renderer.js`); server `applyPlayerMovement` (`game/server/simulation.js`) steps `MOVE_SPEED / TICK_RATE` while input is fresh, slides on walls, and snaps `player.y` to the floor sample.

### Combat loop

**20 Hz** simulation (`TICK_RATE`, `runGameLoopTick` in `game/server/index.js` per lobby): movement, enemies, minions, passive draws, regen, then `stateUpdate`.

`useCard` validates slot, cooldown, and Magic Stones, then branches by type: weapon cones/projectiles (`game/server/simulation.js`), spell radial effects, creature minion spawns, or enchantments on the ground/self. Deaths call `removeDeadEnemies` (`game/server/progression.js`) for loot and drop tracking. `updateEnemies` chases and attacks players; damage honors invulnerability, shields, and block.

**Lock-on** (`game/docs/controls.md`, `game/client/lockOn.js`): Z or gamepad acquires the nearest foe; `game/client/renderer.js` uses `targetRelativeDirection` for strafe movement and target-facing attacks while the camera orbits (repeat-press behavior from `game/client/settings.js`).

### Key item (dodge roll)

Default **Dodge Roll** (`equippedKeyItemId: 'dodge_roll'`): **E** / gamepad (`game/docs/controls.md`) → `useKeyItem` in `game/server/index.js` dashes along movement input (or facing), wall-clamped, with ~300ms i-frames and 800ms cooldown. Other key items use the same event with different effect branches.

### Loot, currency, and lobby services

Enemy deaths spawn Magic Stone and currency loot (`game/server/progression.js`, drop tables in `game/server/config.js`); crystals support collection quests. `lootPickup` within `LOOT_PICKUP_RADIUS` (`game/server/index.js`) restores stones or adds currency. In lobby: rotating **shop** (`buyShopCard`), player **trades**, and **medic** heal for 10 currency (`healAtMedic`).

### Co-op simulation and drop-in

One `lobby.state` per channel holds shared layout, enemies, loot, minions, enchantments, telepipe, and run objectives; everyone gets the same `stateUpdate` each tick. **Drop-in** runs `initializePlayerForActiveRun` (hand, HP, Magic Stones, cooldowns) without resetting the dungeon. Reconnect uses `DISCONNECT_GRACE_MS`; ticks skip disconnected, dead, or extracted players.
