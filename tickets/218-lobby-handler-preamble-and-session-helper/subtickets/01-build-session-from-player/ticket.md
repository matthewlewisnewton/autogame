# 01 — buildSessionFromPlayer helper

Extract the duplicated lobby-session object literal into a single `buildSessionFromPlayer` helper and use it everywhere the server registers or restores a browsing session. This removes the copy-paste between connection-time `registerSession` and the `leaveLobby` fallback when no session exists yet.

## Acceptance Criteria

- `buildSessionFromPlayer(player)` exists in `game/server/index.js` (near `buildPlayerRecord` / `withLobbyFromSocket`) and returns `{ playerId, accountId, username, selectedDeck, inventory, ownedCards, currency }` using `player.id` (or equivalent) for `playerId`.
- On connect, `lobbies.registerSession(playerId, …)` uses `buildSessionFromPlayer(sessionPlayer)` instead of an inline object.
- On `leaveLobby`, the `getSession(playerId) || { … }` fallback uses `buildSessionFromPlayer(sessionPlayer)` (or the live lobby player if that is the intended source of truth — behavior must match pre-refactor: same fields persisted after leave).
- No other functional changes to socket handlers in this sub-ticket.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **File:** `game/server/index.js`
  - Add `function buildSessionFromPlayer(player) { … }` after `buildPlayerRecord` (or adjacent session helpers).
  - Replace inline session at connection (`lobbies.registerSession` in the `io.on('connection')` block, ~lines 1125–1133).
  - Replace inline fallback in `socket.on('leaveLobby')` (~lines 1193–1201).
- Session shape must stay compatible with `lobbies.registerSession` / `getSession` consumers (`game/server/lobbies.js`, auth/reconnect tests).

## Verification: code
