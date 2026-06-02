# Surface cosmetic on player runtime state + stateUpdate snapshot

Wire the account's persisted `cosmetic` into the live player runtime record and
into every `stateUpdate` snapshot, so all connected clients receive each player's
`{ bodyColor, accentColor, bodyShape }`. Depends on sub-ticket 01 (the cosmetic
field must already exist on the account record).

## Acceptance Criteria
- When a player's runtime record is built on lobby join, it is populated with the
  account's `cosmetic` object (looked up by `accountId`). If the lookup yields no
  cosmetic, a default cosmetic is used so the field is never undefined.
- The `stateUpdate` snapshot includes a `cosmetic` object for EVERY player entry
  (with `bodyColor`, `accentColor`, `bodyShape`), alongside the existing fields
  like `x`, `y`, `z`, `rotation`.
- A second/peer player's cosmetic is present in the snapshot, not just the local
  player's (cosmetic is visible to peers).
- Changing an account's cosmetic and rejoining is reflected in the next snapshot
  (no stale hardcoded value).

## Technical Specs
- `game/server/index.js`:
  - `buildPlayerRecord(playerId, accountId, username, savedData)` (~line 968): add
    a `cosmetic` field to the runtime player object, sourced from the account
    record via `findUserByAccountId(accountId)?.cosmetic` (import from `./users`),
    falling back to the shared default cosmetic when absent.
- `game/server/progression.js`:
  - `stateSnapshot()` (~line 3045): add `cosmetic: p.cosmetic` (defaulting to the
    default cosmetic if missing) to each `players[id]` entry inside the snapshot
    loop.
- Tests: extend `game/server/test/server.test.js` (or the appropriate existing
  server test) to assert that `stateSnapshot()` includes a complete `cosmetic`
  object for each player and that it reflects the account's stored cosmetic.

## Verification: code
