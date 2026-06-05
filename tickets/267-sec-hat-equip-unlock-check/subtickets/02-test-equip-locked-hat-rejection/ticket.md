# 02-test-equip-locked-hat-rejection

Add automated tests that prove locked catalog hats cannot be equipped through profile update or the lobby appearance-change socket path.

## Acceptance Criteria

- A unit test creates a fresh account (default `unlockedHats` only), calls `updateProfile` with `{ cosmetic: { hat: 'crown' } }`, expects `{ ok: false }` and a reason matching `/not unlocked/i`, and confirms `cosmetic.hat` was not changed
- An integration test connects a player in lobby, emits `applyAppearanceChange` with `{ cosmetic: { hat: 'wizard' } }` (not in default unlocks), receives `appearanceError` with a not-unlocked reason, and confirms neither live player nor account cosmetic was updated
- Equipping an owned starter hat (`bandana`) via `applyAppearanceChange` still succeeds (regression guard)
- New tests pass under the harness vitest suite (`pnpm test`)

## Technical Specs

- **File:** `game/server/test/cosmetic.test.js` — add or verify a test in the cosmetic/users describe block: `createUser`, then `updateProfile(accountId, { cosmetic: { hat: 'crown' } })`, assert rejection and unchanged hat
- **File:** `game/server/test/apply_appearance_change.test.js` — add a test using existing helpers (`connectInLobby`, `waitForEvent`): emit locked hat, await `appearanceError`, assert reason and unchanged `users.findUserByAccountId(accountId).cosmetic.hat`; keep the existing free `bandana` hat-only test passing

## Verification: code
