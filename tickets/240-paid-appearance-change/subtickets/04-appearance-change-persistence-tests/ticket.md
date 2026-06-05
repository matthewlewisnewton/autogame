# 04 — Appearance change persistence and crash-safety tests

Add regression tests proving paid appearance edits cannot be exploited via
partial persistence: currency must be saved before the account cosmetic write,
and a failure between those steps must not grant a free appearance change.

## Acceptance Criteria

- A new vitest in `game/server/test/` drives `applyAppearanceChange` with real
  file persistence (`FileProvider` for player progress + `setTestFilePath` for
  `users.json`), following `hat_unlock_persistence.test.js`.
- **Success path order:** on a paid appearance change, `provider.savePlayer`
  runs before `saveUsers` / before the account cosmetic on disk changes.
- **Insufficient funds:** player with `currency < APPEARANCE_CHANGE_COST` receives
  `appearanceError`; reloaded disk state shows unchanged currency and unchanged
  account cosmetic.
- **Between-steps failure:** after currency is persisted, force the account
  cosmetic write to fail (spy `updateProfile` or `saveUsers` to throw / return
  `{ ok: false }`). After reloading both stores from disk:
  - persisted `currency` reflects the refund (no net deduction), **or** if the
    handler intentionally leaves charged-but-not-applied state, document and
    assert that cosmetic was **not** applied (no free-edit outcome). Prefer the
    refund path matching `unlockHat`.
  - account `cosmetic` appearance fields are unchanged on disk.
- **Hat-only free path:** `applyAppearanceChange` with only `hat` changed deducts
  no currency and updates the equipped hat.
- `pnpm test:quick` (or the narrowest filter for the new file) passes.

## Technical Specs

- Add `game/server/test/appearance_change_persistence.test.js` using patterns
  from `game/server/test/hat_unlock_persistence.test.js`, `helpers.js`
  (`startTestServer`, `connectClient`, `waitForEvent`), and `users.js`
  (`setTestFilePath`, `clearUsers`, `loadUsers`).
- Seed a lobby player with known currency and a distinct baseline cosmetic;
  emit `applyAppearanceChange` with altered `bodyColor` or `proportions`.
- Use `APPEARANCE_CHANGE_COST` from `game/server/config.js` for expected
  deduction amounts.
- Use `hasAppearanceFieldChanges` only in assertions if helpful; production code
  belongs in sub-tickets 01–02 (do not re-implement the handler here).

## Verification: code
