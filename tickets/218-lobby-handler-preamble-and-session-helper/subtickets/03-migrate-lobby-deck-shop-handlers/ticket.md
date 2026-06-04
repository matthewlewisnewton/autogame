# 03 — Migrate deck / shop / grind handlers to withLobbyPlayer

Convert the lobby-phase inventory and economy socket handlers to `withLobbyPlayer` with `requirePhase: 'lobby'`, removing the repeated `if (!isLobbyPhase(state)) return` and `const player = state.players[socket.playerId]; if (!player) return` preambles. Handler bodies (validation, emits, `savePlayerData`) stay behavior-identical.

## Acceptance Criteria

- Each handler below uses `withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => { … })` instead of `withLobbyFromSocket` plus manual phase/player preamble:
  - `deckAddCard`
  - `deckRemoveCard`
  - `sellCard`
  - `buyShopCard`
  - `grindCard`
  - `evolveCard`
  - `unlockHat`
- No duplicate `isLobbyPhase` / `state.players[socket.playerId]` guards remain inside those handlers.
- Event names, error reasons, and side effects unchanged (e.g. `deckError`, `cardInventoryUpdate`, hat unlock ordering).
- `cd game && pnpm test:quick` passes (including deck/grind/evolution/hat-related tests in `game/server/test/`).

## Technical Specs

- **File:** `game/server/index.js` — socket handlers in the `io.on('connection')` block (~lines 1402–1692).
- Replace pattern:
  ```js
  withLobbyFromSocket(socket, (state) => {
    if (!isLobbyPhase(state)) return;
    const player = state.players[socket.playerId];
    if (!player) return;
    // body
  });
  ```
  with `withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => { … })`.
- Handlers that do not take `lobby` today may ignore the `lobby` parameter; do not change signatures of extracted modules (`sellCard`, `buyShopCard`, etc. in `progression.js`).

## Verification: code
