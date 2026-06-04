# 01 — Lobby phase API in lobbies.js

Introduce a single source of truth for lobby `gamePhase` values and transition helpers in `game/server/lobbies.js`. No call-site migrations yet beyond initializing new lobby state with the constant; behavior stays identical.

## Acceptance Criteria

- `game/server/lobbies.js` exports `PHASES` (`lobby`, `playing`) and documents that run suspend/resume uses `run.status === 'suspended'` while `gamePhase` remains `lobby` (not a third phase value).
- `setPhase(lobby, nextPhase)` sets `lobby.state.gamePhase`, validates `nextPhase` is a known `PHASES` value, and uses `canTransition(from, to)` (exported) so illegal transitions throw or return `false` with a clear error — legal transitions: `lobby↔playing` and idempotent same-phase sets.
- `createLobbyGameState()` initializes `gamePhase` via `PHASES.LOBBY` (not a bare string literal).
- `game/server/test/lobbies.test.js` covers `canTransition` for all allowed pairs, rejects unknown phase strings, and asserts `setPhase` updates `lobby.state.gamePhase`.
- `pnpm exec vitest run server/test/lobbies.test.js` passes; full `pnpm test:quick` still green (no other files changed except tests).

## Technical Specs

- **`game/server/lobbies.js`**: Add `PHASES`, `canTransition(from, to)`, `setPhase(lobby, nextPhase)`, and export them from `module.exports`. Keep string values `'lobby'` / `'playing'` so client payloads and existing tests stay compatible.
- **`game/server/test/lobbies.test.js`**: Import and test the new exports; existing createLobby expectations unchanged except they may assert against `PHASES.LOBBY`.

## Verification: code
