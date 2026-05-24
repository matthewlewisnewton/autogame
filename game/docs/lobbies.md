# Lobby Browser & Multi-Lobby Architecture

This document describes the lobby browser flow introduced to replace auto-placement of players into a single shared game on connect. Each lobby owns its own dungeon state; players browse, create, and join lobbies before entering the existing in-lobby UI (deck editor, quest board, ready-up, etc.).

## Player flow

```
Login → Lobby Browser → create/join lobby → Lobby UI → ready up → playing
                              ↑                                    |
                              └──────── leave / drop-in ───────────┘
```

1. **Connect** — Client authenticates and receives `init` with account data and a lobby list. The player is **not** placed into any game state yet (`inLobby: false`).
2. **Lobby browser** — Player creates a lobby or joins one from the list. In-run lobbies show a **Drop In** button instead of **Join**.
3. **Lobby UI** — Existing pre-run UI: deck editor, quest selection, shop, trades, ready button.
4. **Run start** — When every player in the lobby is ready and has a valid deck, the server emits `startGame` to that lobby's Socket.IO room.
5. **Leave / drop-in** — A player can leave at any time. If others remain, the dungeon persists. When the last player leaves, the lobby is deleted.

## Server architecture

### Module: `server/lobbies.js`

In-memory lobby registry (not persisted across server restarts).

| Export | Purpose |
|--------|---------|
| `createLobby(hostId, name?)` | Creates a lobby with fresh `gamePhase: 'lobby'` state |
| `getLobbyById` / `getLobbyForPlayer` | Lookup helpers |
| `assignPlayerToLobby` / `removePlayerFromLobby` | Membership; deletes lobby when empty |
| `listLobbySummaries` | Public lobby list for the browser UI |
| `registerSession` / `getSession` | Staging data while a player is browsing (not in a lobby) |

Each lobby object:

```js
{
  id,           // 8-char hex
  name,
  hostId,       // reassigns to next player when host leaves
  state,        // full GameState for this lobby (players, enemies, run, layout, …)
  createdAt,
}
```

Lobby state is initialized via `createLobbyGameState()` and tagged with `state._lobbyId` for scoped Socket.IO broadcasts.

### Lobby-scoped game state

Previously a single global `gameState` in `server/index.js` held all players. Now:

- **Global `gameState`** — Legacy fallback used by unit tests that import handlers without creating a lobby.
- **Per-lobby `lobby.state`** — Authoritative state for connected players in that lobby.

Progression and simulation modules read/write through a shared `_gameState` pointer set by `withLobbyContext`:

```js
function withLobbyContext(lobby, fn) {
  // Push lobby.state onto sim + progression
  // Run fn()
  // Pop stack and restore parent lobby or global gameState
}
```

**Re-entrancy:** Handlers often call helpers (e.g. `broadcastLobbyUpdate`) that also enter `withLobbyContext`. A context **stack** ensures nested calls restore the parent lobby state instead of always resetting to the global `gameState`. Without this, `playerReady` → `broadcastLobbyUpdate` → `checkAllReady` would see an empty global state and never emit `startGame`.

Socket.IO rooms: on join, `socket.join(lobby.id)`. Progression emits (`startGame`, `stateUpdate`, `runComplete`, …) use `getIoTarget()` → `io.to(_gameState._lobbyId)` when `_lobbyId` is set.

### Game loop

`runGameLoopTick` iterates all active lobbies each tick. Each lobby's simulation runs inside `withLobbyContext`.

### Drop-in during an active run

When `joinLobby` is called on a lobby with `gamePhase === 'playing'`:

- Player record is added (or restored from persistence).
- `initializePlayerForActiveRun` sets up hand, deck, HP, magic stones, and cooldowns.
- Existing enemies, run objective, and layout are unchanged for remaining players.

When a player **leaves** mid-run:

- Player data is saved; minions owned by that player are removed.
- If at least one player remains, the run continues.
- If the lobby empties, it is deleted (state discarded).

## Socket events

### Client → server

| Event | Payload | Notes |
|-------|---------|-------|
| `listLobbies` | — | Requests current lobby list |
| `createLobby` | `{ name? }` | Fails if already in a lobby |
| `joinLobby` | `{ lobbyId }` | Join or drop-in |
| `leaveLobby` | — | Returns player to browser; saves progress |

All existing gameplay events (`playerReady`, `move`, `useCard`, …) require the socket to be in a lobby; otherwise `lobbyError` is emitted.

### Server → client

| Event | When |
|-------|------|
| `init` | Connect — account info, `lobbies[]`, `inLobby: false` |
| `lobbyListUpdate` | `{ lobbies }` — broadcast on create/join/leave/disconnect |
| `lobbyJoined` | Entered a lobby — full state, layout, deck, shop, quests |
| `lobbyLeft` | Left a lobby — `{ lobbies }` for browser refresh |
| `lobbyError` | `{ reason }` — validation / not-in-lobby errors |
| `lobbyUpdate` | Player list / phase changes within current lobby |
| `startGame` | All players ready — scoped to lobby room |

## Client architecture

### UI (`client/index.html`)

- **`#lobby-browser`** — Full-screen overlay after login: lobby list, create form, errors.
- **`#lobby`** — Existing pre-run lobby (deck, quests, ready).
- **`#leave-lobby-btn`** — Emits `leaveLobby`, returns to browser.

### Flow (`client/main.js`)

- `init` → `showLobbyBrowser()` + `renderLobbyList(data.lobbies)`.
- `lobbyJoined` → `applyLobbyJoinedData()` + show `#lobby`.
- `lobbyLeft` → clear state, `showLobbyBrowser()`, refresh list.
- `lobbyListUpdate` → refresh list when browser is visible.
- List entries show phase (**Waiting** / **In run**), player count, and selected dungeon.

## Testing

### Unit tests

```bash
cd game && pnpm exec vitest run server/test/lobbies.test.js
```

Covers lobby CRUD, summaries, host reassignment, and empty-lobby deletion.

### Integration tests

```bash
cd game && pnpm exec vitest run server/test/integration.test.js -t "Lobby"
```

Key scenarios: create/join, list updates, leave, mid-run persistence, `playerReady` → `startGame`, last-player disconnect deletes lobby.

Test helpers in `server/test/helpers.js`:

- `connectClient(baseUrl, accountId, { joinLobbyId?, skipLobby?, name? })` — auto-creates or joins a lobby after `init`.
- `connectTwoClients(baseUrl)` — two players in the same lobby.

### Smoke tests

**Socket-only two-player drop-in** (no browser; runs in CI):

```bash
# Requires server on :3000 (or set SERVER_URL)
cd game && pnpm run test:smoke:lobby-dropin
```

Registers two users, creates/joins a lobby, starts a run, player 2 leaves and drop-in rejoins.

**Two-browser UI** (Playwright; manual):

```bash
# Requires server on :3000 and client on :5173
# Install Chromium once after pnpm install in game/client:
cd game/client && pnpm exec playwright install chromium
cd game/client && node scripts/test-lobby-browser.mjs
```

Uses two isolated browser contexts: login → create → join → ready → start → leave → drop-in via `[data-join-mode="drop-in"]`.

Environment variables:

| Variable | Default | Used by |
|----------|---------|---------|
| `SERVER_URL` | `http://localhost:3000` | Both smoke scripts |
| `CLIENT_URL` | `http://localhost:5173` | Browser script only |

`BASE_URL` is accepted as an alias for `SERVER_URL` for backward compatibility.

### Local dev

```bash
cd game && pnpm run dev   # server :3000 + client :5173
```

Manual check: open http://localhost:5173 in two windows (or incognito + normal), log in as different users, and walk through create → join → ready → leave → drop-in.

## Future work

- Persist lobbies across server restarts (optional; current design is in-memory).
- Lobby passwords / invite links.
- Max players per lobby and kick/ban.
- Chat in lobby browser or in-lobby UI.
