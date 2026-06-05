# 01-enforce-hat-unlock-on-profile-equip

`validateCosmetic` in `cosmetic.js` (lines 101–103) only checks that a hat id exists in the catalog, not that the account owns it. Add an unlock gate in `updateProfile` so equipping a hat via `PATCH /api/me/profile` (and any caller that persists cosmetics through `updateProfile`, including `applyAppearanceChange`) rejects locked paid hats instead of saving them.

## Acceptance Criteria

- `updateProfile` returns `{ ok: false }` when `cosmetic.hat` is a valid catalog id but not present in the account's `unlockedHats` (after `backfillUnlockedHats`)
- Rejection reason indicates the hat is not unlocked (e.g. `'Hat is not unlocked for this account'`)
- Equipping a default starter hat (`bandana`, `beanie`, or `none`) on a fresh account still succeeds
- After rejection, the account's persisted `cosmetic.hat` is unchanged

## Technical Specs

- **File:** `game/server/users.js` — in `updateProfile`, immediately after a successful `validateCosmetic` call, if `result.value.hat !== undefined`, load `backfillUnlockedHats(user.unlockedHats)` and return `{ ok: false, reason: 'Hat is not unlocked for this account' }` when the hat is missing from that list; only merge/persist cosmetic fields when the check passes
- **File:** `game/server/cosmetic.js` — leave `validateCosmetic` catalog-only; account unlock is enforced at the persistence call site because validation has no account context
- **File:** `game/server/socketHandlers/lobbyHandlers.js` — no separate change required if `applyAppearanceChange` already delegates hat-only updates to `updateProfile`; verify the existing flow surfaces `profileResult.reason` via `appearanceError` on failure

## Verification: code
