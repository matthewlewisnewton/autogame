# 02 — Customization panel markup and styles

Add the Character customization section to the existing Account overlay: shape
picker, body-color palette, accent-color palette, a preview mount point, and a
dedicated save control. Markup and CSS only — no save or preview logic yet.

## Acceptance Criteria

- `#account-overlay` / `#account-modal` contains a new `settings-section` titled "Appearance" (or "Character") with:
  - Four shape options (`box`, `cylinder`, `cone`, `capsule`) as toggle buttons or radio inputs with stable ids (`cosmetic-shape-box`, etc.).
  - A body-color swatch grid (`#cosmetic-body-colors`) with at least six preset hex swatches plus a "Custom" control (`#cosmetic-body-custom`, `type="color"`).
  - An accent-color swatch grid (`#cosmetic-accent-colors`) with the same pattern.
  - An empty preview container `#cosmetic-preview` (min height ~120px) for the next sub-ticket.
  - `#cosmetic-save-btn` button labeled e.g. "Save appearance".
  - `#cosmetic-error` element (hidden by default) for validation/API errors.
- Styles in `style.css` match existing account/settings patterns: `.settings-section`, `.settings-field`, `.settings-hint`, selected-state highlight on shape buttons and swatches.
- Section is present in `index.html` and does not break existing username save UI.

## Technical Specs

- **File**: `game/client/index.html`
  - Insert the Appearance block inside `#account-modal` after the display-name section and before the logout section.
  - Use `role="radiogroup"` / `aria-checked` on shape controls; swatches as `<button type="button">` with `aria-label` including the color hex.
- **File**: `game/client/style.css`
  - `#cosmetic-preview`: bordered panel, centered content area, dark background consistent with `#account-modal`.
  - `.cosmetic-shape-btn`, `.cosmetic-swatch`: grid/flex layout; `.selected` state (border or glow) matching `.lobby-tab.active` accent color.
  - `#cosmetic-error`: reuse `.account-error` / `.settings-error` styling.

## Verification: code
