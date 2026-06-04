# 02 — Regression test: crash between currency and hat writes

Add an automated test that simulates failure between the two persistence steps of hat
unlock and proves on-disk state cannot grant a free hat. Depends on sub-ticket 01
(currency must be saved before the account hat write).

## Acceptance Criteria

- A new vitest in `game/server/test/` covers the `unlockHat` flow with real file
  persistence (`FileProvider` for player progress and `setTestFilePath` for
  `users.json`), not only in-memory maps.
- **Call order (success path):** on a successful unlock, `provider.savePlayer` (or
  equivalent) is invoked before `saveUsers` / before the account `unlockedHats`
  append is persisted to disk (spy or sequential assertions).
- **Between-steps failure:** after currency is persisted, the account hat write is
  prevented (e.g. `vi.spyOn` on `users.unlockHat` or `saveUsers` to throw or return
  `{ ok: false }` without writing `unlockedHats` to disk). After reloading both
  stores from disk (simulate restart: `loadUsers()` + `provider.loadPlayer`):
  - persisted `currency` reflects the deduction;
  - `unlockedHats` on the account does **not** include the purchased hat.
- **No free-hat regression:** the test explicitly documents that the old ordering
  (hat saved before currency) would have produced the opposite unsafe outcome; the
  assertion fails if hat is on disk while currency was not deducted.
- If the handler refunds on account-write failure (per sub-ticket 01), include a
  separate case asserting refunded currency is persisted after the failure path.
- `pnpm test:quick` (or the narrowest vitest filter for the new file) passes.

## Technical Specs

- Add `game/server/test/hat_unlock_persistence.test.js` (name may vary) using existing
  patterns from `game/server/test/helpers.js` (`startServer`, `createTestToken`,
  `waitForEvent`), `game/server/test/persistence.test.js` (`FileProvider`, temp dirs),
  and `game/server/test/users.test.js` (`setTestFilePath`, `clearUsers`).
- Drive unlock via `socket.emit('unlockHat', { hatId })` in lobby phase with a
  priced catalog hat (e.g. `cap` at 50) and enough `player.currency` (set on the
  in-lobby player and/or seeded progress file).
- Use `game/server/cosmetic.js` (`getHat`) for expected price; use
  `findUserByAccountId` after `loadUsers()` for account state.
- Do not change production code except any tiny test-only export already used
  elsewhere; implementation belongs in sub-ticket 01.

## Verification: code
