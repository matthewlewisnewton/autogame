# Top-right HUD stack scaffold and key-item toolbar clearance

Introduce a fixed top-right HUD column so in-run badges no longer share the same absolute coordinates as `#app-toolbar`. Move `#key-item-indicator` into the new stack with enough top offset to clear the toolbar button row (account, level settings, mute, settings).

## Acceptance Criteria

- `#top-right-hud-stack` exists in the in-run DOM (inside or sibling to `#ui`) and contains `#key-item-indicator` as its first child.
- `#key-item-indicator` no longer uses `top: 36px` absolute placement that overlaps the toolbar band; the stack starts at or below the reserved toolbar clearance (`#app-toolbar` at `top: 12px` with 40px-tall buttons).
- With a visible equipped key item (e.g. default `dodge_roll`), the key-item badge bounding box does not intersect any `#app-toolbar` button bounding box at 1280×800.
- `#app-toolbar` buttons remain `pointer-events: auto` and are not covered by the key-item badge (`z-index` / stacking does not block clicks).
- No change to key-item flash/cooldown/ready behavior beyond layout.

## Technical Specs

- **`game/client/index.html`** — Add `<div id="top-right-hud-stack">` wrapping `#key-item-indicator` (lock-on panel and comms log stay put for sub-ticket 02).
- **`game/client/style.css`** — Add `#top-right-hud-stack` rules:
  - `position: fixed; right: 16px; top: var(--top-right-hud-stack-top, 60px);` (tune `--top-right-hud-stack-top` to clear the full toolbar row).
  - `display: flex; flex-direction: column; align-items: flex-end; gap: 8px; pointer-events: none; z-index: 10;`
  - Define `--top-right-hud-stack-top` (or equivalent) documenting toolbar clearance math (12px offset + 40px button height + gap).
- **`game/client/style.css`** — Update `#key-item-indicator`: remove `top` / `right` absolute anchors; use `position: relative` (or static) inside the stack. Preserve existing grid, opacity, cooldown, and icon styling.
- Do **not** reposition `#lock-on-info-panel`, `#quest-comms-log`, or quest toast logic in this sub-ticket.

## Verification: code
