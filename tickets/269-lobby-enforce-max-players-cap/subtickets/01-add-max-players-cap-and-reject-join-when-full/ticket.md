# 01-add-max-players-cap-and-reject-join-when-full

Add `MAX_PLAYERS = 16` to server config and enforce the cap in the lobby-join path: reject with `lobbyError({ reason: 'Lobby is full' })` when a lobby already has 16 players. The check must cover both the lobby-phase join and the drop-in (playing-phase) join.

The existing `removePlayerFromLobby()` already deletes the player from `lobby.state.players` on both explicit leave and disconnect, so the count naturally decrements — no additional plumbing needed there.

## Acceptance Criteria

- `MAX_PLAYERS` is exported from `game/server/config.js` with value `16`
- Emitting `joinLobby` to a lobby with 16 players emits `lobbyError` with reason containing "full" (case-insensitive) and does NOT add the player
- The cap check applies to BOTH lobby-phase joins AND drop-in (playing-phase) joins
- A lobby with 15 players still accepts a 16th join normally
- Explicit leave (`leaveLobby`) by one of 16 players decrements the count, allowing a 17th external joiner
- Disconnect of one of 16 players decrements the count, allowing a new joiner

## Technical Specs

- **`game/server/config.js`** — Add `const MAX_PLAYERS = 16;` and export it in `module.exports`
- **`game/server/socketHandlers/lobbyHandlers.js`** — In the `joinLobby` handler, after resolving `lobby` but before calling `joinLobbyWithPhasePolicy`, check `Object.keys(lobby.state.players).length >= MAX_PLAYERS` and emit `lobbyError({ reason: 'Lobby is full' })` if true
- Import `MAX_PLAYERS` from `../config` in `lobbyHandlers.js`

## Verification: code
