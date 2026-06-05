# 04 — Appearance charge persistence tests

Add server vitest coverage for the paid appearance-change flow: insufficient funds,
currency-then-commit ordering, crash-safety between persistence steps, and free
hat-only saves. Mirrors `game/server/test/hat_unlock_persistence.test.js`.

Depends on sub-tickets **01** and **02**.

## Acceptance Criteria

- New file `game/server/test/appearance_change_persistence.test.js` (name may vary)
  uses real file persistence: `FileProvider` for player progress and
  `setTestFilePath` for `users.json`, with `startTestServer` / `connectClient` /
  `waitForEvent` helpers.
- **Insufficient funds:** player with `currency < APPEARANCE_CHANGE_COST` emits
  `applyAppearance` with an appearance change; receives `appearanceError`; currency
  and account cosmetic on disk are unchanged.
- **Success ordering:** on a paid appearance change, `savePlayer` (currency
  deduction) is persisted to disk before `users.json` reflects the new cosmetic
  (spy or sequential read of progress file vs users file mid-flow).
- **Crash between steps:** after currency is on disk, block the account cosmetic
  write (mock `updateProfile`, `saveUsers`, or `renameSync` on users file). After
  reload from disk: currency reflects the deduction; cosmetic does **not** reflect
  the edit (charged-but-not-applied, retryable — not a free-edit exploit).
- **Account-write failure refund:** when `updateProfile` fails after currency was
  saved, assert currency is refunded on disk (same pattern as hat unlock sub-ticket
  01 refund case).
- **Hat-only free save:** changing only `hat` (no appearance field delta) succeeds
  with `cost: 0`, cosmetic `hat` updated on account, currency unchanged.
- **Currency save throws:** if `savePlayerData` fails after in-memory deduction,
  handler aborts before `updateProfile`; disk currency and cosmetic unchanged.
- `pnpm test:quick` (or filtered vitest run for the new file) passes.

## Technical Specs

- **`game/server/test/appearance_change_persistence.test.js`** — new vitest suite;
  seed lobby player with known currency via `FileProvider.savePlayer`; drive
  `socket.emit('applyAppearance', { cosmetic: … })` in lobby phase.
- Use `APPEARANCE_CHANGE_COST` from `game/server/config.js` and
  `appearanceFieldsChanged` / `backfillCosmetic` from `game/server/cosmetic.js`
  for expected values.
- Follow temp-dir cleanup patterns from `hat_unlock_persistence.test.js`.
- No production code changes unless a minimal test hook is strictly required.

## Verification: code
