## Refresh cosmetic on drop-in socket reconnect

`reconnectPlayerToLobby` and the existing-player branch of `joinPlayerToLobby` never re-read `findUserByAccountId(accountId)?.cosmetic`. If a player updates their profile via `PATCH /api/me/profile` while soft-disconnected from a lobby, the next drop-in reconnect can broadcast a stale `cosmetic` until they leave the lobby entirely (which deletes `state.players[playerId]` and forces `buildPlayerRecord` on re-entry). Decide whether drop-in rejoin should mirror account profile or freeze appearance for the run; if refresh is desired, set `player.cosmetic = withCosmeticDefaults(findUserByAccountId(...)? .cosmetic)` on reconnect.

### Acceptance Criteria
- After `PATCH /api/me/profile` changes `cosmetic`, a soft-disconnect + `reconnectPlayerToLobby` flow yields the updated `cosmetic` in the next `stateUpdate` (or document intentional freeze-in-run behavior in design docs).

## Treat empty cosmetic PATCH as no-op without disk write

`updateProfile` treats `normalizeCosmetic({})` as success with `cosmeticUpdate = {}` (truthy), triggering `saveUsers()` even when nothing changed. Consider skipping the merge/save when `Object.keys(cosmeticUpdate).length === 0`.

### Acceptance Criteria
- `PATCH /api/me/profile` with `{ "cosmetic": {} }` returns `200` without rewriting `users.json` (or returns `400` with a clear “no cosmetic fields” error).

## Add top-level ticket.md to the ticket folder

The harness references `ticket.md` at the ticket root, but only sub-ticket specs exist in git. Future senior reviews should not need to reconstruct acceptance criteria from `decompose.txt`.

### Acceptance Criteria
- `tickets/181-character-customization-server-cosmetic-profile/ticket.md` exists with the five top-level acceptance criteria and matches implemented scope.
