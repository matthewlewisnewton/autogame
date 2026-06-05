# Cleanup nits from 269-lobby-enforce-max-players-cap

> **Staleness note.** This follow-up ticket was written against commit
> `fe0362a` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `269-lobby-enforce-max-players-cap`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Align lobby-browser Full label with connected-player cap

The server rejects joins when **connected** players ≥ 16, but the client marks a lobby Full when `lobby.playerCount` (total `state.players` rows, including disconnect ghosts during the 60s grace window) ≥ 16. After a disconnect from a full lobby, the server frees a slot immediately while the browser may still show a disabled **Full** button until the ghost is evicted.

### Acceptance Criteria
- Lobby list uses the same connected-player semantics as the server cap (either expose `connectedCount` in `lobbySummary` or derive it client-side from player summaries).
- A lobby with 15 connected + 1 ghost shows a clickable Join/Drop In button, not **Full**.
- Existing server cap tests continue to pass; add a client-side or integration assertion for the grace-window case if practical.

## Centralize MAX_LOBBY_PLAYERS in shared constants

`MAX_LOBBY_PLAYERS = 16` is defined independently in `game/server/config.js` and `game/client/config.js`. Other cross-cutting limits (e.g. magic stones, hand slot order) live in `game/shared/constants.json`.

### Acceptance Criteria
- Single source of truth for lobby capacity in `shared/constants.json` (or equivalent shared module).
- Server and client import the same value; removing either duplicate literal.
- Existing `maxPlayers.test.js` constant assertion still passes.
