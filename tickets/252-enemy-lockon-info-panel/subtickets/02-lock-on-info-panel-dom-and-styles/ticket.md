# Lock-on info panel DOM and styles

Add a compact HUD panel shell in the in-game UI layer that matches existing Vanguard/objective HUD styling. The panel stays hidden until runtime wiring (sub-ticket 03) toggles it during lock-on.

## Acceptance Criteria

- `#lock-on-info-panel` exists inside `#ui`, carries a `hidden` class by default, and contains stable child elements:
  - `#lock-on-target-name` — enemy display name heading
  - `#lock-on-target-variant` — variant badge/label (may stay empty/hidden when no variant)
  - `#lock-on-target-hp` — HP line (`HP 100/100` format reserved for runtime)
  - `#lock-on-target-stats` — container for stat rows (empty until runtime fills it)
  - `#lock-on-target-description` — one- or two-line flavor text
- CSS positions the panel as a small fixed HUD card (top-right, below the app toolbar / above the card hand safe area), with the same dark translucent chrome as `#objective-hud` / `#vanguard-hud` (rounded border, readable type, `pointer-events: none`, appropriate `z-index`).
- Variant badge styling reuses or mirrors `.variant-codex-badge` colors where practical (optional `--badge-color` inline from runtime later).
- Panel does not intercept clicks on the canvas or card hand.
- No JavaScript behavior changes in this sub-ticket beyond any DOM queries needed for future wiring (prefer none).

## Technical Specs

- **`game/client/index.html`** — Insert `#lock-on-info-panel` block near other HUD elements (after `#objective-hud` or adjacent to `#hud-meta`).
- **`game/client/style.css`** — Add `#lock-on-info-panel` rules plus child selectors; include `.hidden { display: none !important; }` compatibility if not already scoped to the new element.
- Do **not** modify `renderer.js`, `lockOn.js`, or server code in this sub-ticket.

## Verification: code
