# 02 — Cosmetic in player runtime state & stateUpdate snapshot

Surface each account's cosmetic profile to the live game: attach it to the
player's runtime record when they join, and include it in the `stateUpdate`
snapshot so every connected client receives every player's cosmetic.

Depends on sub-ticket 01 (account records must already carry `cosmetic`).

## Acceptance Criteria
- When a player record is built (`buildPlayerRecord` in `server/index.js`), the
  player object gains a `cosmetic` field sourced from the account record
  (`findUserByAccountId(accountId).cosmetic`), falling back to the shared default
  cosmetic when no account/record is found.
- The `stateUpdate` snapshot (`stateSnapshot` in `server/progression.js`) includes
  a `cosmetic` field for every player entry, carrying that player's full
  `{ bodyColor, accentColor, bodyShape }`.
- The cosmetic in the snapshot reflects the account's current stored cosmetic
  (a player who joins after updating their cosmetic appears with the updated
  values).

## Technical Specs
- `game/server/index.js`:
  - In `buildPlayerRecord(playerId, accountId, username, savedData)`, look up the
    account via the already-imported `users` module
    (`findUserByAccountId(accountId)`) and set
    `player.cosmetic = account?.cosmetic ?? { ...DEFAULT_COSMETIC }`. Import
    `DEFAULT_COSMETIC` (and `findUserByAccountId` if not already imported) from
    the cosmetic/users module created in sub-ticket 01.
- `game/server/progression.js`:
  - In `stateSnapshot()`, add `cosmetic: p.cosmetic ?? <default>` to the
    per-player serialized object (alongside `x`, `y`, `hp`, etc.).
- Add/extend a server test (e.g. in `server/test/server.test.js` or a new test)
  asserting that a built player record carries `cosmetic` and that the snapshot
  exposes it per player.

## Verification: code
