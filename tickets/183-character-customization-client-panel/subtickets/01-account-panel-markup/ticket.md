# 01 — Account overlay cosmetic panel markup & styles

Add the static HTML and CSS for the Phase-A customization controls inside the
existing Account overlay, matching the layout patterns used by Settings
(`settings-section`, `settings-field`, modal chrome).

## Acceptance Criteria
- `#account-overlay` contains a **Appearance** section (below the username
  block, above logout) with:
  - `#cosmetic-body-colors` — a row of preset body-color swatch buttons (≥6
    choices) plus `data-color` hex on each.
  - `#cosmetic-accent-color` — `<input type="color">` for accent.
  - `#cosmetic-body-shapes` — one button per shape: `box`, `cylinder`, `cone`,
    `capsule` (`data-shape` on each).
  - `#cosmetic-preview` — empty preview viewport for a later ticket to paint.
  - `#cosmetic-save-btn` and `#cosmetic-error` (hidden by default).
- Swatches and shape buttons use `aria-pressed` (or equivalent) for the selected
  state; CSS shows a clear selected style.
- Styles in `style.css` reuse existing overlay tokens (`settings-section`,
  `#account-modal`, close button) so the panel matches Settings/Account modals.
- `#character-frame` keeps `#character-id` for initials; add
  `#character-portrait` inside the frame as a sibling target for cosmetic styling
  in a later sub-ticket (may be empty for now).
- `settings-layout.test.js` (or a small new layout test) asserts the cosmetic
  element ids exist in `index.html`.

## Technical Specs
- `game/client/index.html`:
  - Insert a `settings-section` with heading "Appearance" inside
    `#account-modal` after the username section.
  - Add `#character-portrait` inside `#character-frame` before `#character-id`.
- `game/client/style.css`:
  - `.cosmetic-swatches`, `.cosmetic-shape-btn`, `#cosmetic-preview` (min
    height ~80px, bordered), `.cosmetic-swatches button[aria-pressed="true"]`,
    shape selected state.
  - Optional: `#character-portrait` base styles (hidden or zero-size until
    wired).
- `game/client/test/settings-layout.test.js`: one `it()` for cosmetic control
  ids and `#character-portrait` presence.

## Verification: code
