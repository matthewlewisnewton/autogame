# Settings storage size cap

Add a maximum serialized JSON size for per-account settings files so repeated PATCHes cannot grow storage without bound. Surface cap violations as PATCH errors and cover the full acceptance criteria with tests.

## Acceptance Criteria

- A `SETTINGS_MAX_BYTES` constant (recommend **8192**) caps the UTF-8 byte length of the persisted settings JSON.
- `updateSettings` refuses to write when the backfilled merged settings exceed the cap; the on-disk file is unchanged.
- `PATCH /api/me/settings` returns **400** with a clear `{ error }` when the cap would be exceeded.
- Legitimate settings (defaults plus typical binding/profile overrides) still persist successfully under the cap.
- Tests demonstrate that repeated PATCHes adding new unknown keys no longer grow the stored file (unknown keys pruned + cap enforced), and that an intentionally oversized payload is rejected.
- `pnpm test:quick` (or the harness vitest server suite) passes for `game/server/test/settings.test.js` and `game/server/test/account.test.js`.

## Technical Specs

- **`game/server/settings.js`**
  - Export `SETTINGS_MAX_BYTES`.
  - After merge + `backfillSettings`, compute `Buffer.byteLength(JSON.stringify(settings), 'utf8')` (or equivalent); if over cap, throw/return an error before `writeFileSync`.
  - Optionally re-sanitize on load: if an existing on-disk file exceeds the cap, fall back to `getDefaultSettings()` (document behavior in a brief comment).
- **`game/server/account.js`**
  - Map cap-exceeded errors from `updateSettings` to `400` + `{ error }`.
- **`game/server/test/settings.test.js`**
  - Test cap rejection when merged settings would be too large.
  - Test that a sequence of PATCHes with junk keys does not monotonically increase stored byte size.
- **`game/server/test/account.test.js`**
  - Test PATCH returns 400 when cap exceeded via HTTP.

## Verification: code
