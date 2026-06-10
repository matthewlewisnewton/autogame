# Wire settings validation into persistence and PATCH route

Connect `validateSettings` and `backfillSettings` (from sub-ticket 01) into `updateSettings`, `getSettings`, and `PATCH /api/me/settings` so arbitrary JSON can no longer be deep-merged and persisted.

## Acceptance Criteria

- `updateSettings` validates the PATCH partial via `validateSettings` before merging; invalid known fields cause an error and no file write.
- Unknown keys in a PATCH body are not persisted (pruned from the validated partial before merge).
- `getSettings` / `mergeWithDefaults` run `backfillSettings` on loaded JSON so legacy files with junk keys are sanitized on read.
- `GET /api/me` returns settings containing only whitelisted keys (no arbitrary nested keys from disk).
- `PATCH /api/me/settings` returns **400** with an `{ error }` message when validation fails (same pattern as cosmetic validation in `game/server/account.js`).
- `PATCH /api/me/settings` with valid fields still deep-merges and returns **200** with merged settings.
- Existing happy-path tests in `game/server/test/settings.test.js` and `game/server/test/account.test.js` are updated or extended to assert pruning/rejection behavior.

## Technical Specs

- **`game/server/settings.js`**
  - `updateSettings(accountId, partial)`: call `validateSettings(partial)`; throw or return a structured error on failure; merge only `validation.value` into current settings; persist the `backfillSettings` result so the on-disk file never contains unknown keys.
  - `getSettings` / `mergeWithDefaults`: replace naive `deepMerge(getDefaultSettings(), stored)` with `backfillSettings(stored)` (or equivalent) so reads always yield a sanitized object.
- **`game/server/account.js`**
  - In `PATCH /me/settings`, catch validation errors from `updateSettings` and respond with `400` + `{ error: reason }`; keep the existing non-object body check.
- **`game/server/test/settings.test.js`**
  - Add cases: junk top-level key in PATCH is not stored; invalid `lockOnRepeatAction` / boolean type rejected; reload after manual junk file write returns pruned settings.
- **`game/server/test/account.test.js`**
  - Add cases: PATCH with invalid field returns 400; PATCH with extra unknown key does not appear in subsequent GET /api/me settings.

## Verification: code
