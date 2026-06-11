# Saving a display name updates the live lobby player without rejoin

Saving a new display name via the account overlay updates the stored account but
leaves the in-memory lobby player record's `username` stale, and never refreshes
the lobby. The new name must propagate to live player records and re-broadcast
the lobby so the PLAYERS list and trade dropdown update without rejoining.

## Acceptance Criteria

- Changing the username via `PATCH /api/me/profile` updates the `username` on the
  matching live player record(s) in the active game state and any lobby state
  (i.e. records whose `accountId` matches the updated account).
- After a successful username change, the lobby is re-broadcast so connected
  clients receive an updated `lobbyUpdate` player list reflecting the new name —
  no socket reconnect/rejoin is required for the change to appear.
- The sync only runs when the username actually changed (`usernameChanged`), not
  on email/cosmetic-only updates.
- When the account has no live player record, the handler completes without error.

## Technical Specs

- `game/server/index.js`: add a `syncLivePlayerUsername(accountId, username)`
  function mirroring `syncLivePlayerCosmetic` (~line 1179) — iterate
  `gameState.players` and every `lobbies._lobbies` lobby's `state.players`,
  assigning `player.username = username` where `player.accountId === accountId`.
  After assigning, trigger a lobby refresh for the affected lobby via the
  existing `broadcastLobbyUpdate` so the player list payload is re-sent. Export
  the new function in the `module.exports` block (~line 1875) alongside
  `syncLivePlayerCosmetic`.
- `game/server/account.js`: in the `PATCH /me/profile` handler (~line 124),
  inside the `if (result.usernameChanged)` block, require and call
  `syncLivePlayerUsername(req.accountId, user.username)` (same require-from-index
  pattern used for `syncLivePlayerCosmetic`).
- Builds on sub-ticket 01: the lobby player payload now carries `username`, so
  re-broadcasting after the sync surfaces the new name in the PLAYERS list and
  trade dropdown.

## Verification: code
