# 02 — Unlock Hats by Spending Currency

Add the server flow that lets a player spend their in-game currency to unlock a
hat from the catalog. The unlock is recorded permanently on the account
(`unlockedHats`) while currency is deducted from the runtime player, mirroring
the existing lobby purchase flows (`buyShopCard`, `grindCard`). Depends on the
schema added in sub-ticket 01.

## Acceptance Criteria
- A lobby-phase Socket.IO handler `unlockHat` accepts a `{ hatId }` payload.
- Unlocking is validated server-side: the hat must exist in the catalog, must
  not already be in the account's `unlockedHats`, and the player must have at
  least the hat's `price` in currency. On any failure the handler emits an
  error event and makes NO state change (currency and unlockedHats unchanged).
- On success: the hat's `price` is subtracted from `player.currency`, the hatId
  is appended to the account's `unlockedHats` (no duplicates), and BOTH are
  persisted — `savePlayerData` for currency and the account `unlockedHats`
  write through `users.js` (`saveUsers`).
- On success the handler emits an update to the requesting client carrying the
  updated `unlockedHats` and the player's remaining `currency`.
- The equipped hat is carried through the `stateUpdate` snapshot: every
  player's `cosmetic` in the snapshot includes its `hat` field.

## Technical Specs
- `game/server/users.js`:
  - Add `unlockHat(accountId, hatId)` → `{ ok: true, unlockedHats } | { ok: false, reason }`.
    Validates the account exists and the hatId is a catalog id; appends to
    `unlockedHats` if absent (dedupe) and calls `saveUsers()`. Export it.
- `game/server/progression.js`:
  - Add `unlockHatForPlayer(player, hatId)` modeled on `buyShopCard`/`grindCard`:
    looks up the catalog price via `getHat`, returns `{ ok: false, reason }` if
    the hat is unknown or `player.currency < price`; on success deducts
    `player.currency` and returns `{ ok: true, cost, currency }`. Export it.
    (Do NOT record the unlock here — that is the account's job.)
- `game/server/index.js`:
  - Add `socket.on('unlockHat', (data) => { ... })` inside the connection
    handler, guarded by `withLobbyFromSocket` and `state.gamePhase === 'lobby'`,
    matching the structure of `buyShopCard`. Steps: resolve the player; reject
    if the hat is already unlocked (look up the account via the player's
    `accountId`); call `unlockHatForPlayer` to deduct currency; on success call
    `users.unlockHat(player.accountId, hatId)`; emit a success event (e.g.
    `hatUnlocked` with `{ unlockedHats, currency }`) and call
    `savePlayerData(socket.playerId)`. Emit an error event (e.g. `deckError` or
    a `hatError`) on any validation failure.
- Confirm `cosmetic.hat` is present in the `stateUpdate` snapshot (it flows
  through the existing `cosmetic` field added in sub-ticket 01 — verify, don't
  duplicate the field).

## Verification: code
