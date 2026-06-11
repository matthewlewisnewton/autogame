# Render usernames instead of raw UUIDs in lobby list, trade dropdown, and portrait HUD

The lobby `lobbyUpdate` player payload omits `username`, so the lobby PLAYERS
list and the Card Economy trade-target dropdown fall back to the raw
accountId/playerId UUID. The vanguard portrait character-id also derives its
2-char label from the UUID. Carry `username` in the payload and render it (with
a UUID fallback) at every player-facing identity point.

## Acceptance Criteria

- The server `lobbyUpdate` player array includes a `username` field for each
  player (falling back to the player id when no username is set).
- The lobby PLAYERS list renders the username/display name followed by the
  ready/standby status — never the raw UUID — for players that have a username.
- The Card Economy trade-target dropdown options show the username/display name,
  not the UUID, for other players in the lobby.
- The vanguard portrait character-id label is derived from the local player's
  username (e.g. its first characters) rather than from the raw player id/UUID.
- When a player has no username, the existing UUID fallback is preserved so the
  UI never renders empty.

## Technical Specs

- `game/server/index.js` — `lobbyPlayerList(state)` (~line 700): add
  `username: p.username || id` to each returned entry, mirroring
  `lobbyPlayerSummaries` in `game/server/lobbies.js`. This is the array sent as
  `players` in `broadcastLobbyUpdate`.
- `game/client/main.js` — `renderPlayerList(players)` (~line 4048): change the
  `li.textContent` to use `p.username || p.id` for the name portion.
- `game/client/main.js` — `updateVanguardPortrait()` (~line 2128): pass the local
  player's username to `formatCharacterId` (e.g.
  `gameState.players[myId]?.username || myId`) instead of bare `myId`.
- `game/client/vanguard-hud.js` — `formatCharacterId` already slices the first 2
  chars of its argument; no signature change needed if the caller passes the
  username. Update its doc comment to reflect it labels from a display name.
- The trade-target dropdown (`renderTradeForm` in `game/client/main.js`, ~line
  2845) already uses `player.username || player.id`; it is fixed automatically
  once the server payload carries `username`. No change required there, but
  verify it consumes the new field.
- Do NOT change the save-name sync path; that is handled in sub-ticket 02.

## Verification: code
