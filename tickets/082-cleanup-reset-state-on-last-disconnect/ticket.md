# Cleanup nits from 058-reset-state-on-last-disconnect

> **Staleness note.** This follow-up ticket was written against commit
> `42b0d57` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `058-reset-state-on-last-disconnect`.
None blocked acceptance — clean them up when convenient.

## Redundant lobby broadcast in disconnect handler

When the last player disconnects, `returnPlayersToLobby()` already calls `broadcastLobbyUpdate()` internally. The disconnect handler's trailing `if (gameState.gamePhase === 'lobby') broadcastLobbyUpdate();` then fires a second time because `gamePhase` is now `'lobby'`. Harmless but redundant — one broadcast is enough.

### Acceptance Criteria
- In `game/server/index.js` disconnect handler, `broadcastLobbyUpdate()` is invoked at most once per disconnect event (either via `returnPlayersToLobby()` or via the lobby-phase fallback, but not both).
- All existing integration tests still pass.
