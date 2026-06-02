# 01 — Hat State Cache, Equip Control & Preview

Extend the existing Account-overlay "Character" customization panel so it can
show the server hat catalog, mark which hats the account owns, and let the
player **equip** an already-unlocked hat (saved via the existing
`PATCH /api/me/profile` cosmetic flow). The server hat catalog/unlock data
(`GET /api/me` returns `unlockedHats` + `hatCatalog`) and the avatar hat
rendering (`renderer.js` `buildHatMesh` / `createPlayerAvatar`, driven by
`cosmetic.hat`) already exist — this sub-ticket only adds the client state
cache, the equip UI, and threads `hat` through save + live preview. Spending
currency to unlock a locked hat is sub-ticket 02.

## Acceptance Criteria
- The client cosmetic cache includes a `hat` field: `getAccountCosmetic()`
  returns `{ bodyColor, accentColor, bodyShape, hat }`, with `hat` defaulting to
  `'none'` when missing/legacy (mirroring the server `DEFAULT_COSMETIC`).
- `loadAccountSettings` caches the `unlockedHats` array and `hatCatalog` array
  returned by `GET /api/me`, and exposes accessors `getUnlockedHats()` (always
  an array, always including `'none'`) and `getHatCatalog()` (array of
  `{ id, name, price }`, falling back to an empty array when absent).
- The Account overlay "Character" section renders one entry per `hatCatalog`
  hat showing its display `name`; each entry indicates whether the hat is
  **owned** (id present in `unlockedHats`) vs **locked**, and which hat is
  currently **equipped** (matches the cached `cosmetic.hat`).
- Clicking an **owned** hat entry sets it as the in-progress equipped hat,
  updates the equipped/selected highlight, and refreshes the live 3D preview so
  the avatar shows that hat. Clicking a **locked** hat does NOT equip it (unlock
  is handled in sub-ticket 02).
- The **Save** button includes the chosen `hat` in the
  `patchProfile({ cosmetic: { bodyColor, accentColor, bodyShape, hat } })`
  payload, so the equipped hat persists; after save the cached cosmetic (incl.
  `hat`) is updated and re-syncing the panel shows the saved hat selected.
- Opening the panel syncs the hat list to the currently cached cosmetic/owned
  state (a hat equipped earlier is shown selected after reload/re-login).
- The live preview avatar reflects the in-progress `hat` selection (the
  preview's cosmetic object carries `hat` through to `createPlayerAvatar`).

## Technical Specs
- `game/client/settings.js`:
  - Add `hat: 'none'` to the client `DEFAULT_COSMETIC` mirror and include it in
    `normalizeCosmetic` (accept only a string, else default `'none'`).
  - Add module state `cachedUnlockedHats` / `cachedHatCatalog`; populate both in
    `loadAccountSettings` from `data.unlockedHats` / `data.hatCatalog` (validate
    arrays; ensure `'none'` is always in unlocked). Export `getUnlockedHats()`
    and `getHatCatalog()`.
- `game/client/index.html`: add a hat list container (e.g.
  `#cosmetic-hat-list`) inside the existing "Character" `settings-section` of
  `#account-overlay`.
- `game/client/main.js`:
  - Add `hat` to the `cosmeticSelection` object (default `'none'`).
  - In `syncCosmeticForm`, set `cosmeticSelection.hat` from `getAccountCosmetic()`
    and (re)build the hat list from `getHatCatalog()` + `getUnlockedHats()`,
    marking owned/locked and the equipped entry.
  - Add a `buildHatList()`/`refreshHatList()` helper that renders the catalog
    entries; clicking an owned entry sets `cosmeticSelection.hat`, refreshes the
    highlight, and calls `refreshCosmeticPreview()`.
  - Include `hat: cosmeticSelection.hat` in the Save handler's `cosmetic`
    payload (around the existing `cosmeticSaveBtnEl` click handler).
- `game/client/cosmetic-preview.js`: ensure the cosmetic object passed to
  `createPlayerAvatar` includes `hat` (forward the field through
  `openPreview`/`updatePreview`; do not strip it).
- `game/client/style.css`: minimal styling for the hat list / entry states
  (owned, locked, equipped/selected), reusing existing `cosmetic-*` patterns.
- Keep `bodyColor`/`accentColor`/`bodyShape` behavior unchanged.

## Verification: code
