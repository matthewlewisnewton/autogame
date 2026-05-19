# Cleanup nits from 027-run-summary-return-to-lobby

> **Staleness note.** This follow-up ticket was written against commit
> `be38667` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `027-run-summary-return-to-lobby`.
None blocked acceptance — clean them up when convenient.

## Pause entity AI while a run is terminal

After a run reaches `victory`/`failed`, the server game loop keeps running
`updateEnemies()` and `updateMinions()`, so enemies and minions visibly keep
moving behind the summary overlay. Player input is correctly frozen, but the
world is not, which looks slightly off during the summary screen.

### Acceptance Criteria
- When `gameState.run.status` is `victory` or `failed`, enemy and minion AI
  movement is skipped (or otherwise paused) until `returnToLobby`.

## Explicitly clear pendingSummons on return to lobby

`returnPlayersToLobby()` relies on the next game-loop tick to clear each
player's `pendingSummons` set. It works in practice, but clearing it explicitly
in `resetTransientRunState()` or `returnPlayersToLobby()` would make the
"clear pending combat-only state" intent self-evident and tick-independent.

### Acceptance Criteria
- `returnPlayersToLobby()` clears every connected player's `pendingSummons`
  without depending on the game loop.
