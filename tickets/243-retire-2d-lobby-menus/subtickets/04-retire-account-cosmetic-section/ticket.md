# Retire the 2D character editor in the Account overlay

Remove the old 2D character/cosmetic editor (`#cosmetic-section`) from the
Account overlay so character customization happens only through the character
booth (`#character-booth-overlay`). The Account overlay keeps its display-name
and logout sections.

## Acceptance Criteria

- The Account overlay no longer contains the cosmetic/character editor —
  `#cosmetic-section` (preview canvas, body/accent swatches, shape select, hat
  list, proportion sliders, Save character) is removed from
  `game/client/index.html`.
- The Account overlay still shows the display-name field/save and the logout
  button.
- The character booth still opens the cosmetic editor (`#character-booth-overlay`)
  and edits apply to the avatar; the `?booth=character` debug hook still opens it.
- The `#lobby-browser` (lobby-finder) menu is unchanged.
- Tests green (`pnpm test` server + client).

## Technical Specs

- `game/client/index.html`: delete the `<div id="cosmetic-section">` block (lines
  for `#cosmetic-preview-canvas`, `#cosmetic-body-swatches`,
  `#cosmetic-accent-swatches`, `#cosmetic-shape-select`, `#cosmetic-hat-list`,
  `#cosmetic-proportions` sliders, `#cosmetic-error`, `#cosmetic-save-btn`) from
  `#account-overlay`. Keep the display-name section and `account-actions`/logout.
- `game/client/main.js`: remove the account-overlay cosmetic wiring — the
  `#cosmetic-*` element refs, the `accountCosmeticForm` (the `createCosmeticForm`
  instance bound to those elements), the account cosmetic-preview open/close
  (`openCosmeticPreview`/`closeCosmeticPreview` for the account canvas),
  `syncCosmeticForm`, and `showCosmeticError` calls tied to `#cosmetic-error`.
  Leave the character-booth cosmetic path (`showBoothCosmeticError`,
  `characterBooth.js`) and the shared `setAccountCosmetic`/`getAccountCosmetic`
  state intact.
- `game/client/characterBooth.js`, `cosmeticForm.js`, `cosmetic-preview.js`:
  unchanged — the character booth remains the sole cosmetic editor.
- Update affected tests: any `game/client/test/*` that builds an account-overlay
  cosmetic fixture or asserts on `#cosmetic-*` elements (search the test dir for
  `cosmetic-section`/`cosmetic-save-btn`).

## Verification: code
