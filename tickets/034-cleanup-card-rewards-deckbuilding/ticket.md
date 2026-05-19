# Cleanup nits from 026-card-rewards-deckbuilding

> **Staleness note.** This follow-up ticket was written against commit
> `00ab4ee` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `026-card-rewards-deckbuilding`.
None blocked acceptance — clean them up when convenient.

## Multi-card reward names collapse onto one line

`showRunSummary` in `game/client/main.js` joins multiple card reward names with
`\n` and assigns them to `summaryRewardsCardsEl.textContent`, but `#summary-rewards-cards`
in `game/client/style.css` does not set a `white-space` value, so newlines collapse.
Currently only one card is ever granted so it is not visible, but it becomes a bug
the moment a run grants more than one card.

### Acceptance Criteria
- Multiple card reward names render on separate lines in the run summary overlay
  (e.g. via `white-space: pre-line` or per-card DOM elements).

## Dead "reconnecting player" branch in connection handler

The connection handler in `game/server/index.js` has an `else` branch intended for
reconnecting players, but `socket.on('disconnect')` deletes `gameState.players[socket.id]`
and Socket.IO assigns a fresh id per connection, so the branch is unreachable and
its comment ("reconnecting players keep their accumulated currency...") is misleading.

### Acceptance Criteria
- Either remove the unreachable `else` branch and correct the comment, or implement
  genuine reconnect identity so the branch can actually be hit.
