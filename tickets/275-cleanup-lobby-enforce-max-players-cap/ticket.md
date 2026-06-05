# Cleanup nits from 269-lobby-enforce-max-players-cap

> **Staleness note.** This follow-up ticket was written against commit
> `88153342` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `269-lobby-enforce-max-players-cap`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Deduplicate max-players test helpers

`game/server/test/max_players_cap.test.js` reimplements `startTestServer`, `connectClient`, and `waitForEvent` inline instead of importing from `game/server/test/helpers.js` as the sub-ticket spec suggested. Consolidating would reduce drift if connection helpers evolve.

### Acceptance Criteria
- `max_players_cap.test.js` imports shared helpers where equivalent helpers exist
- All six max-players tests still pass without behavior change

## Auto-route on full lobby (goal follow-up)

The ticket goal mentions the lobby-finder routing or creating another lobby when join is rejected for capacity. The server correctly emits `lobbyError({ reason: 'Lobby is full' })` and the client shows the message, but there is no automatic fallback to another lobby or create flow.

### Acceptance Criteria
- When `joinLobby` returns a full-lobby error, the client either offers to create a new lobby or auto-joins the next non-full lobby from the current list
- User sees clear feedback for which action was taken

## Document MAX_PLAYERS in lobbies.md

`game/docs/lobbies.md` documents join/create/leave events but does not mention the 16-player cap or the `Lobby is full` error reason.

### Acceptance Criteria
- `lobbies.md` notes `MAX_PLAYERS = 16` and that `joinLobby` emits `lobbyError` when the lobby is at capacity
