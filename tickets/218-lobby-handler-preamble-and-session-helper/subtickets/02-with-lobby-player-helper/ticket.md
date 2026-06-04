# 02 — withLobbyPlayer wrapper

Add `withLobbyPlayer(socket, options, fn)` on top of `withLobbyFromSocket` so handlers can receive `(state, lobby, player)` without repeating lobby lookup, phase guards, and `state.players[socket.playerId]` resolution. No handler migrations in this sub-ticket — only the helper (and optional focused unit coverage).

## Acceptance Criteria

- `withLobbyPlayer(socket, options, fn)` is defined in `game/server/index.js`, implemented by delegating to `withLobbyFromSocket` (same “not in a lobby” → `lobbyError` behavior).
- When `options.requirePhase` is `'lobby'`, the wrapper returns early (no `fn` call) if `!isLobbyPhase(state)`; when `'playing'`, early return if `!isPlayingPhase(state)`. Omit `requirePhase` to skip phase assertion.
- Default phase mismatch is a **silent return** (matches `deckAddCard`, `sellCard`, etc.). When `options.phaseMismatch` is set (e.g. `{ event: 'medicError', payload: { reason: 'not_in_lobby' } }`), emit that event on mismatch instead of returning silently.
- Resolves `const player = state.players[socket.playerId]`; if missing, return silently (no `fn` call).
- On success, calls `fn(state, lobby, player)`.
- Existing `withLobbyFromSocket` call sites are unchanged in this sub-ticket.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **File:** `game/server/index.js`
  - Place `withLobbyPlayer` immediately after `withLobbyFromSocket` (~line 626).
  - Import/use existing `isLobbyPhase` / `isPlayingPhase` from `lobbies` (already imported as `PHASES, isLobbyPhase, isPlayingPhase`).
  - Options shape (document in a one-line JSDoc): `{ requirePhase?: 'lobby' | 'playing', phaseMismatch?: { event: string, payload: object } }`.
- **Optional:** `game/server/test/server.test.js` — one small test that stubs a minimal lobby + socket and asserts phase/player gating (only if easy without new exports); otherwise rely on existing suite staying green.

## Verification: code
