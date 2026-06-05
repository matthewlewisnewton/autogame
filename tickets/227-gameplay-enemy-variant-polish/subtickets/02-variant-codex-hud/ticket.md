# 02-variant-codex-hud

Add a variant codex/legend overlay in the HUD so players can read what each enemy variant does. The overlay is toggleable (press a key, e.g., `C` for codex) and shows the four variant names with their color badge and a one-line description of each variant's ability.

## Acceptance Criteria

- Pressing `C` during a dungeon run toggles a variant codex overlay visible on screen
- The overlay lists all four variants (volatile, warded, leeching, frenzied) with their badge color and a short description:
  - **Volatile** (orange): Explodes on death, dealing radial damage
  - **Warded** (cyan): Protected by a shield that absorbs damage
  - **Leeching** (teal): Heals for a fraction of damage dealt
  - **Frenzied** (red): Enrages below 50% HP, gaining speed and attack
- Overlay has a semi-transparent dark background and is positioned to not obscure the action (e.g., right side or top-right corner)
- Pressing `C` again hides the overlay; pressing Escape also hides it

## Technical Specs

**`game/client/index.html`**
- Add `#variant-codex-overlay` div (initially `display: none`) containing the four variant entries with colored badge indicators and description text. Style inline or via existing HUD CSS patterns.

**`game/client/main.js`**
- Add keydown handler for `c` key to toggle `#variant-codex-overlay` visibility (only active during `playing` game phase)
- Also hide overlay on `Escape` key (alongside existing escape handlers)
- Add `showVariantCodex()` / `hideVariantCodex()` helper functions

**`game/client/config.js`** (or inline in main.js)
- Add `VARIANT_CODEX_DATA` constant array with variant name, color hex, and description string for each of the four variants — used to populate the overlay

## Verification: code
