# Sync saved cosmetic to live player runtime state

Saving cosmetics in the Account overlay updates the persisted account and client cache (`patchProfile` → `cachedCosmetic`), but `gameState.players[id].cosmetic` is only set at join time. Wire profile-save so connected avatars in the hub and in-run receive the new cosmetic on the next render without reconnecting.

## Acceptance Criteria

- After a successful `PATCH /api/me/profile` that includes `cosmetic`, every connected runtime player record for that `accountId` has its `cosmetic` field updated to the merged account value.
- The next `stateSnapshot` / `stateUpdate` broadcast includes the updated cosmetic for that player (local and remote clients).
- On the client, after a successful `patchProfile({ cosmetic })`, the local `gameState.players[myId].cosmetic` is updated immediately (via `setGameStateRef`) so the avatar refreshes before the next socket tick.
- A server unit test covers: register → join player → patch cosmetic → assert live player record and snapshot reflect the new fields (e.g. `bodyColor`, `hat`, `proportions.height`).

## Technical Specs

- `game/server/index.js` (or `game/server/progression.js` if lobby state lives there):
  - Add `syncLivePlayerCosmetic(accountId, cosmetic)` that finds active players with matching `accountId` across in-memory game/lobby state and assigns a deep copy of the backfilled cosmetic.
- `game/server/account.js`:
  - After a successful `updateProfile` that touched `cosmetic`, call `syncLivePlayerCosmetic(req.accountId, user.cosmetic)`.
- `game/client/main.js`:
  - In the cosmetic save handler (after successful `patchProfile`), merge `getAccountCosmetic()` into `gameState.players[myId].cosmetic` when `myId` is set, then call `setGameStateRef(gameState)`.
- `game/server/test/cosmetic_runtime.test.js` or new `game/server/test/cosmetic_live_sync.test.js` — test live sync behavior.

## Verification: code
