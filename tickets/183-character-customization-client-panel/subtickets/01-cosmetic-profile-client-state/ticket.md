# 01 — Cosmetic profile client state

Extend the account settings module so the client loads, caches, and returns each
account's Phase-A `cosmetic` object from `GET /api/me`, and merges cosmetic
updates from `PATCH /api/me/profile` responses. This is the data layer the
customization panel will read and write.

## Acceptance Criteria

- `loadAccountSettings()` stores `cosmetic: { bodyColor, accentColor, bodyShape }` from `GET /api/me` (defaulting to server defaults when absent).
- New exported `getCosmetic()` returns the cached cosmetic object (never `undefined`).
- `patchProfile()` accepts an optional `cosmetic` field in its argument object, sends it in the PATCH body, and updates the cached cosmetic from a successful `200` payload.
- Failed profile PATCH (`4xx`) leaves the cached cosmetic unchanged.
- Unit tests cover: load populates cosmetic, `getCosmetic()` after load, successful `patchProfile({ cosmetic })` updates cache, failed PATCH does not mutate cache.

## Technical Specs

- **File**: `game/client/settings.js`
  - Add `cachedCosmetic` (or fold into profile cache) initialized to `{ bodyColor: '#4f9dde', accentColor: '#f2c94c', bodyShape: 'box' }` matching `game/server/cosmetic.js` defaults.
  - In `loadAccountSettings()`, assign `cachedCosmetic` from `data.cosmetic` after backfill/merge with defaults.
  - Export `getCosmetic()` returning a shallow copy of the cached object.
  - In `patchProfile(fields)`, include `cosmetic` in `JSON.stringify(fields)` when provided; on `res.ok`, assign `cachedCosmetic` from `data.cosmetic` when present.
- **File**: `game/client/test/settings.test.js` (create if missing, or extend nearest existing settings test file)
  - Mock `fetch` for `/api/me` and `/api/me/profile`; assert cosmetic round-trip and failure rollback.

## Verification: code
