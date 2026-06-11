# Cleanup nits from lobby-registry-abandoned-lobbies-are-never-cleaned-up-ghost-ducq

> **Staleness note.** This follow-up ticket was written against commit
> `936b4167` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `lobby-registry-abandoned-lobbies-are-never-cleaned-up-ghost-ducq`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Redundant trade cancellation in reapAbandonedLobbies

In `game/server/index.js`, `reapAbandonedLobbies()` calls
`cancelTradesForPlayer(lobby.state.pendingTrades, playerId)` for each player and
then immediately calls `lobbies.removePlayerFromLobby(playerId)`, which already
clears that player's pending trades. The explicit call is harmless but dead work.

### Acceptance Criteria
- The per-player trade cleanup in the reaper relies on `removePlayerFromLobby`
  (or keeps only `savePlayerData`) without a redundant `cancelTradesForPlayer`
  call, and existing reap/integration tests still pass.
