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
