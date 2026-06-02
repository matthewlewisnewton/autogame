# Customization Panel — Controls, State & Save

Add a character-customization section to the Account overlay (opened by the
existing account button, available in the lobby) that lets a player pick a
**body color**, **accent color**, and **body shape**, then **Save** them. The
server cosmetic profile (`PATCH /api/me/profile`, validated in
`game/server/cosmetic.js`) and the in-run avatar render (renderer
`createPlayerAvatar`) already exist — this sub-ticket only adds the client
controls, the cosmetic state cache, and the save/reload wiring. The live 3D
preview is sub-ticket 02.

## Acceptance Criteria
- The Account overlay gains a "Character" customization section with three
  controls: a **body color** palette (a set of preset swatch buttons), an
  **accent color** picker, and a **body shape** picker offering exactly
  `box`, `cylinder`, `cone`, `capsule` (matching the server `BODY_SHAPES`).
- `settings.js` caches the account `cosmetic` returned by `GET /api/me` in
  `loadAccountSettings`, and exposes a `getAccountCosmetic()` accessor that
  returns `{ bodyColor, accentColor, bodyShape }` (falling back to sensible
  defaults that mirror the server `DEFAULT_COSMETIC`).
- Opening the panel syncs the three controls to the currently cached cosmetic,
  so a value saved earlier is shown again after a page reload (re-login reloads
  it from `GET /api/me`).
- A **Save** button persists the current selection via the existing
  `patchProfile({ cosmetic: { bodyColor, accentColor, bodyShape } })` helper
  (which calls `PATCH /api/me/profile`); on success the cached cosmetic is
  updated so later runs/snapshots use it.
- Save error responses (e.g. a 400 from the server validator) are surfaced in
  the panel via a visible error line rather than failing silently.
- Selected color values sent to the server are `#RRGGBB` hex strings and the
  shape is one of the four allowed enum values (so the existing server
  validator accepts them).

## Technical Specs
- `game/client/index.html`: add a "Character" `settings-section` inside
  `#account-overlay`'s `#account-modal` containing the body-color swatch
  buttons, an accent-color picker (`<input type="color">` or swatch buttons),
  a body-shape `<select id="cosmetic-shape-select">` with the four options,
  a `#cosmetic-save-btn`, and a `#cosmetic-error` line.
- `game/client/settings.js`: store `cachedCosmetic` from the `data.cosmetic`
  field in `loadAccountSettings`; add `getAccountCosmetic()`; ensure
  `patchProfile` keeps the cached cosmetic in sync when the response carries
  `cosmetic`. Reuse the existing `patchProfile` for the network call.
- `game/client/main.js`: grab the new elements, populate/sync them in
  `openAccountOverlay` (extend `syncAccountForm` or add a `syncCosmeticForm`),
  track the in-progress selection, wire the Save button to `patchProfile`, and
  show/clear errors via the `#cosmetic-error` element.
- `game/client/style.css`: minimal styling for the swatch buttons / selected
  state (reuse existing `settings-section` / `settings-field` patterns).
- Define the preset body/accent color palette as a small constant array of
  `#RRGGBB` strings in the client (do not hardcode it server-side).

## Verification: code
