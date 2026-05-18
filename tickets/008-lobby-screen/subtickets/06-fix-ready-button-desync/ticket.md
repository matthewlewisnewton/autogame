# 06 — Fix Ready Button Server Desync

The client's `#ready-btn` click handler toggles a local `isReady` variable and emits `playerReady` on every click. But the server's `playerReady` handler unconditionally sets `ready = true` — it never sets it back to `false`. After a player clicks Ready twice, the button reads "Ready" (implying not-ready) while the server and every other client's list still show them as "Ready".

Fix by making the client send the desired ready state and having the server apply that value.

## Acceptance Criteria
- Clicking Ready a second time (to un-ready) causes the server to set that player's `ready` to `false`
- After un-readying, the `lobbyUpdate` broadcast shows the player as "Not Ready" on all clients
- `checkAllReady()` does **not** trigger `startGame` when a player un-readies (because not all players are ready)
- The button label correctly reflects the actual server-side ready state after each click

## Technical Specs
- **`game/client/main.js`** — Change the `readyBtn` click handler to emit the desired state: `socket.emit('playerReady', isReady)` (where `isReady` is the toggled local value). Alternatively, toggle first then emit `!isReady`.
- **`game/server/index.js`** — Change `socket.on('playerReady', () => { ... })` to accept a `ready` argument: `socket.on('playerReady', (ready) => { ... })`. Set `gameState.players[socket.id].ready = ready` (instead of hardcoding `true`). After updating, call `broadcastLobbyUpdate()` and `checkAllReady()` (same as before — `checkAllReady` naturally won't fire if not all are ready).

## Verification: code
