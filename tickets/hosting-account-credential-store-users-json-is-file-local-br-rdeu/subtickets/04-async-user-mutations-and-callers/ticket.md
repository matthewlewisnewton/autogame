# Async user mutations persist through the provider

Convert the remaining user-mutation helpers (`updateProfile`, `unlockHat`, `unlockQuestTier`, `completeQuestTier`) to async functions that `await persistUserAsync` when a provider is configured, and update their call sites to `await` them. Cosmetics and quest-unlock writes must reach shared storage for multi-instance hosting.

## Acceptance Criteria

- `updateProfile`, `unlockHat`, `unlockQuestTier`, and `completeQuestTier` are `async` and `await persistUserAsync(user)` whenever a mutation is persisted (same conditions as today's `saveUsers()` calls)
- Username renames call `_usersProvider.deleteUser(oldUsername)` then `saveUser` when in provider mode
- `game/server/account.js` `PATCH /api/me/profile` handler is `async` and `await updateProfile(...)`
- `game/server/socketHandlers/lobbyHandlers.js` appearance paths `await updateProfile(...)` and hat unlock path `await unlockHatForAccount(...)` (~lines 231, 308, 333)
- `game/server/progression.js` victory/unlock paths `await unlockQuestTier(...)` / `await completeQuestTier(...)` (and any `unlockHat` usage if present)
- File-fallback mode (no provider, `setTestFilePath` tests) still persists via synchronous `saveUsers()` inside `persistUserAsync`
- All existing auth, users, quest-tier, cosmetic, hat-unlock, and appearance persistence tests pass

## Technical Specs

- **File:** `game/server/users.js` — make the four mutation exports async; wire `persistUserAsync` / `deleteUser` as needed
- **File:** `game/server/account.js` — async profile route handler
- **File:** `game/server/socketHandlers/lobbyHandlers.js` — await `updateProfile` and `unlockHatForAccount` in handlers
- **File:** `game/server/progression.js` — await quest-tier unlock/complete calls in run victory handling (~lines 3564–3576)
- **File:** `game/server/debugScenarios.js` — await `unlockQuestTier`, `completeQuestTier`, and `unlockHatForAccount` at all call sites
- **Tests:** update any direct sync calls in `game/server/test/*.js` that invoke the changed functions to use `await` (vitest already supports async `it` blocks); file-mode tests should remain green without switching to Postgres

## Verification: code
